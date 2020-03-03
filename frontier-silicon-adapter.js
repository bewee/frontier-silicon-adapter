/**
 * frontier-silicon-adapter.js - FrontierSilicon adapter.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

const {
  Adapter,
  Device,
  Property,
} = require('gateway-addon');
const SSDPClient = require('node-ssdp').Client;
const FSAPI = require('./fsapi');

let FrontierSiliconAPIHandler = null;
try {
  FrontierSiliconAPIHandler = require('./frontier-silicon-api-handler');
} catch (e) {
  console.log(`API Handler unavailable: ${e}`);
}

const pollInterval = 10000;
const ssdpPollInterval = 10000;
const PIN = "1234";

class RadioProperty extends Property {
  constructor(device, name, propertyDescription, get, set) {
    super(device, name, propertyDescription);
    this.device = device;

    this.unit = propertyDescription.unit;
    this.description = propertyDescription.description;
    this.setCachedValue(propertyDescription.value);
    this.device.notifyPropertyChanged(this);
    this.get = get;
    this.set = set;
    this.update();
  }

  update(){
    var _self = this;
    _self.get(function(data){
      _self.setCachedValue(data);
      _self.device.notifyPropertyChanged(_self);
    });
  }

  setValue(value) {
    var _self = this;
    return new Promise((resolve, reject) => {
      super.setValue(value).then((updatedValue) => {
        _self.set(value);
        resolve(updatedValue);
        _self.device.notifyPropertyChanged(_self);
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

class RadioDevice extends Device {
  constructor(adapter, id, ip, name) {
    super(adapter, id);
    this.ip = ip;

    const deviceDescription = {
      name: name,
      '@type': ['OnOffSwitch'],
      description: name+' Internet Radio',
      properties: {
        on: {
          '@type': 'OnOffProperty',
          label: 'On/Off',
          name: 'on',
          type: 'boolean',
          value: false,
        },
        volume: {
          '@type': 'LevelProperty',
          label: 'Volume',
          name: 'volume',
          type: 'integer',
          minimum: 0,
          maximum: 32,
          value: 13,
        },
      },
    };

    var _self = this;
    this.fsapi = new FSAPI(this.ip, PIN, 
      function(){
        _self.connectedNotify(true);
      },
      function(){
        _self.connectedNotify(false);
      }
    );

    this.name = deviceDescription.name;
    this.type = deviceDescription.type;
    this['@type'] = deviceDescription['@type'];
    this.description = deviceDescription.description;

    this.powerProperty = new RadioProperty(this, 'on', deviceDescription.properties['on'], this.fsapi.get_power.bind(this.fsapi), this.fsapi.set_power.bind(this.fsapi));
    this.properties.set('on', this.powerProperty);
    this.volumeProperty = new RadioProperty(this, 'volume', deviceDescription.properties['volume'], this.fsapi.get_volume.bind(this.fsapi), this.fsapi.set_volume.bind(this.fsapi));
    this.properties.set('volume', this.volumeProperty);

    if (FrontierSiliconAPIHandler) {
      this.links.push({
        rel: 'alternate',
        mediaType: 'text/html',
        href: `http://${this.fsapi.ip}/`,
      });
    }
  }

  revive(){
    this.startInterval();
  }

  connectedNotify(stat){
    super.connectedNotify(stat);
    if(stat){
      this.startInterval();
    } else {
      if(this.interval){
        clearInterval(this.interval);
        delete this.interval;
      }
    }
  }

  startInterval(){
    var _self = this;
    if(!this.interval)
      this.interval = setInterval(function(){
        _self.powerProperty.update();
        _self.volumeProperty.update();
      }, pollInterval);
  }
}

class FrontierSiliconAdapter extends Adapter {
  constructor(addonManager, manifest) {
    super(addonManager, 'FrontierSiliconAdapter', manifest.name);
    addonManager.addAdapter(this);

    if (FrontierSiliconAPIHandler) {
      this.apiHandler = new FrontierSiliconAPIHandler(addonManager, this);
    }

    this.startDiscovery();
  }

  startDiscovery() {
    this.ssdpclient = new SSDPClient();
    var _self = this;
    this.ssdpclient.on('response', function (headers, statusCode, rinfo) {
      if(statusCode == 200){
        if (!_self.devices['frontier-silicon-'+rinfo['address']]) {
          const device = new RadioDevice(_self, 'frontier-silicon-'+rinfo['address'], rinfo['address'], headers['SPEAKER-NAME']);
          _self.handleDeviceAdded(device);
        } else {
          _self.devices['frontier-silicon-'+rinfo['address']].revive();
        }
      }
    });
    _self.search();
    setInterval(function(){
      _self.search();
    }, ssdpPollInterval);
  }
  search(){
    this.ssdpclient.search('urn:schemas-frontier-silicon-com:undok:fsapi:1');
    //this.ssdpclient.search('urn:schemas-frontier-silicon-com:fs_reference:fsapi:1');
    //this.ssdpclient.search('ssdp:all');
  }

  addDevice(deviceId, deviceDescription) {
    return new Promise((resolve, reject) => {
      if (deviceId in this.devices) {
        reject(`Device: ${deviceId} already exists.`);
      } else {
        const device = new RadioDevice(this, deviceId, deviceDescription);
        this.handleDeviceAdded(device);
        resolve(device);
      }
    });
  }

  removeDevice(deviceId) {
    return new Promise((resolve, reject) => {
      const device = this.devices[deviceId];
      if (device) {
        this.handleDeviceRemoved(device);
        resolve(device);
      } else {
        reject(`Device: ${deviceId} not found.`);
      }
    });
  }

  startPairing(_timeoutSeconds) {
    console.log('FrontierSiliconAdapter:', this.name,
                'id', this.id, 'pairing started');
    this.search();
  }

  cancelPairing() {
    console.log('FrontierSiliconAdapter:', this.name, 'id', this.id,
                'pairing cancelled');
  }

  removeThing(device) {
    console.log('FrontierSiliconAdapter:', this.name, 'id', this.id,
                'removeThing(', device.id, ') started');

    this.removeDevice(device.id).then(() => {
      console.log('FrontierSiliconAdapter: device:', device.id, 'was unpaired.');
    }).catch((err) => {
      console.error('FrontierSiliconAdapter: unpairing', device.id, 'failed');
      console.error(err);
    });
  }

  cancelRemoveThing(device) {
    console.log('FrontierSiliconAdapter:', this.name, 'id', this.id,
                'cancelRemoveThing(', device.id, ')');
  }
}

module.exports = FrontierSiliconAdapter;
