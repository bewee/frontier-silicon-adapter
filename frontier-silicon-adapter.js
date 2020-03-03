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
const PIN = "1234";

class PowerProperty extends Property {
  constructor(device, name, propertyDescription) {
    super(device, name, propertyDescription);
    this.device = device;

    this.unit = propertyDescription.unit;
    this.description = propertyDescription.description;
    this.setCachedValue(propertyDescription.value);
    this.device.notifyPropertyChanged(this);
    var _self = this;
    _self.pollPower();
    setInterval(function(){
      _self.pollPower();
    }, pollInterval);
  }

  pollPower(){
    var _self = this;
    _self.device.fsapi.get_power(function(data){
      _self.setCachedValue(data);
      _self.device.notifyPropertyChanged(_self);
    });
  }

  setValue(value) {
    var _self = this;
    return new Promise((resolve, reject) => {
      super.setValue(value).then((updatedValue) => {
        _self.device.fsapi.set_power(value?1:0);
        resolve(updatedValue);
        _self.device.notifyPropertyChanged(_self);
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

class VolumeProperty extends Property {
  constructor(device, name, propertyDescription) {
    super(device, name, propertyDescription);
    this.device = device;

    this.unit = propertyDescription.unit;
    this.description = propertyDescription.description;
    this.setCachedValue(propertyDescription.value);
    this.device.notifyPropertyChanged(this);
    var _self = this;
    _self.pollVolume();
    setInterval(function(){
      _self.pollVolume();
    }, pollInterval);
  }

  pollVolume(){
    var _self = this;
    _self.device.fsapi.get_volume(function(data){
      _self.setCachedValue(data);
      _self.device.notifyPropertyChanged(_self);
    });
  }

  setValue(value) {
    var _self = this;
    return new Promise((resolve, reject) => {
      super.setValue(value).then((updatedValue) => {
        _self.device.fsapi.set_volume(value);
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
          label: 'Volume',
          name: 'volume',
          type: 'integer',
          value: 13,
        },
      },
    };

    this.fsapi = new FSAPI(this.ip, PIN);

    this.name = deviceDescription.name;
    this.type = deviceDescription.type;
    this['@type'] = deviceDescription['@type'];
    this.description = deviceDescription.description;

    const powerProperty = new PowerProperty(this, 'on', deviceDescription.properties['on']);
    this.properties.set('on', powerProperty);
    const volumeProperty = new VolumeProperty(this, 'volume', deviceDescription.properties['volume']);
    this.properties.set('volume', volumeProperty);

    if (FrontierSiliconAPIHandler) {
      this.links.push({
        rel: 'alternate',
        mediaType: 'text/html',
        href: `http://${this.fsapi.ip}/`,
      });
    }
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
      if (!_self.devices['frontier-silicon-'+rinfo['address']]) {
        const device = new RadioDevice(_self, 'frontier-silicon-'+rinfo['address'], rinfo['address'], headers['SPEAKER-NAME']);
        _self.handleDeviceAdded(device);
      }
    });
    this.search();
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
