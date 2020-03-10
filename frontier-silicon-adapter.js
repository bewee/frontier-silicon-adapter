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
const manifest = require('./manifest.json');

const pollInterval = 10000;
const ssdpPollInterval = 10000;
const PIN = "1234";

class RadioProperty extends Property {
  constructor(device, name, propertyDescription, get, set, arr = null) {
    super(device, name, propertyDescription);
    this.device = device;

    this.unit = propertyDescription.unit;
    this.description = propertyDescription.description;
    this.setCachedValue(propertyDescription.value);
    this.device.notifyPropertyChanged(this);
    this.get = get;
    this.set = set;
    this.arr = arr;
    this.update();
  }

  update(){
    var _self = this;
    _self.get(function(data){
      if(_self.arr)
        _self.setCachedValue(_self.arr[parseInt(data)]);
      else
        _self.setCachedValue(data);
      _self.device.notifyPropertyChanged(_self);
    });
  }

  setValue(value) {
    var _self = this;
    return new Promise((resolve, reject) => {
      super.setValue(value).then((updatedValue) => {
        if(_self.arr)
          _self.set(_self.arr.indexOf(value));
        else
          _self.set(value);
        setTimeout(_self.device.updateProperties.bind(_self.device), 1000);
        resolve(updatedValue);
        _self.device.notifyPropertyChanged(_self);
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

class RadioDevice extends Device {
  constructor(adapter, id, ip, name, sysmodelist) {
    super(adapter, id);
    this.ip = ip;
    this.actionsfn = [];

    var _self = this;
    this.fsapi = new FSAPI(this.ip, PIN, 
      function(){
        _self.connectedNotify(true);
      },
      function(){
        _self.connectedNotify(false);
      }
    );

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
        playing: {
          label: 'Play/Pause',
          name: 'playing',
          type: 'boolean',
          value: false,
        },
        muted: {
          label: 'Muted',
          name: 'muted',
          type: 'boolean',
          value: false,
        },
        sysmode: {
          label: 'Mode',
          name: 'sysmode',
          type: 'string',
          enum: sysmodelist,
          value: '0',
        },
      },
    };

    _self.name = deviceDescription.name;
    _self.type = deviceDescription.type;
    _self['@type'] = deviceDescription['@type'];
    _self.description = deviceDescription.description;

    let powerProperty = new RadioProperty(_self, 'on', deviceDescription.properties['on'], _self.fsapi.get_power.bind(_self.fsapi), _self.fsapi.set_power.bind(_self.fsapi));
    _self.properties.set('on', powerProperty);
    let volumeProperty = new RadioProperty(_self, 'volume', deviceDescription.properties['volume'], _self.fsapi.get_volume.bind(_self.fsapi), _self.fsapi.set_volume.bind(_self.fsapi));
    _self.properties.set('volume', volumeProperty);
    let playingProperty = new RadioProperty(_self, 'playing', deviceDescription.properties['playing'], _self.fsapi.get_playing.bind(_self.fsapi), _self.fsapi.set_playing.bind(_self.fsapi));
    _self.properties.set('playing', playingProperty);
    let mutedProperty = new RadioProperty(_self, 'muted', deviceDescription.properties['muted'], _self.fsapi.get_muted.bind(_self.fsapi), _self.fsapi.set_muted.bind(_self.fsapi));
    _self.properties.set('muted', mutedProperty);
    let sysmodeProperty = new RadioProperty(_self, 'sysmode', deviceDescription.properties['sysmode'], _self.fsapi.get_sysmode.bind(_self.fsapi), _self.fsapi.set_sysmode.bind(_self.fsapi), sysmodelist);
    _self.properties.set('sysmode', sysmodeProperty);

    _self.addAction('next', {
      title: '>>',
      description: 'Skip to the next track',
    });
    _self.actionsfn['next'] = _self.fsapi.action_next.bind(_self.fsapi);
    _self.addAction('previous', {
      title: '<<',
      description: 'Skip to the previous track',
    });
    _self.actionsfn['previous'] = _self.fsapi.action_previous.bind(_self.fsapi);

    _self.links.push({
      rel: 'alternate',
      mediaType: 'text/html',
      href: `http://${_self.fsapi.ip}/`,
    });
  }

  async performAction(action) {
    action.start();
    const fn = this.actionsfn[action.name];
    if (fn)
      fn();
    else
      console.warn(`Unknown action ${action}`);
    action.finish();
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
    if(!this.interval)
      this.interval = setInterval(this.updateProperties.bind(this), pollInterval);
  }

  updateProperties(){
    this.properties.get('on').update();
    this.properties.get('volume').update();
    this.properties.get('playing').update();
    this.properties.get('muted').update();
    this.properties.get('sysmode').update();
  }
}

class FrontierSiliconAdapter extends Adapter {
  constructor(addonManager) {
    super(addonManager, 'FrontierSiliconAdapter', manifest.id);
    addonManager.addAdapter(this);

    this.startDiscovery();
  }

  startDiscovery() {
    this.ssdpclient = new SSDPClient();
    var _self = this;
    this.ssdpclient.on('response', function (headers, statusCode, rinfo) {
      if(statusCode == 200){
        if (!_self.devices['frontier-silicon-'+rinfo['address']]) {
          let fsapi = new FSAPI(rinfo['address'], PIN, function(){
            fsapi.getlist_sysmodes(function(list){
              const device = new RadioDevice(_self, 'frontier-silicon-'+rinfo['address'], rinfo['address'], headers['SPEAKER-NAME'], list);
              _self.handleDeviceAdded(device);
            });
          });
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
        const device = new RadioDevice(this, deviceId, deviceDescription, []);
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
