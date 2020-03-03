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

let FrontierSiliconAPIHandler = null;
try {
  FrontierSiliconAPIHandler = require('./frontier-silicon-api-handler');
} catch (e) {
  console.log(`API Handler unavailable: ${e}`);
  // pass
}


const FSAPI = require('./fsapi');
const pollInterval = 10000;

class PowerProperty extends Property {
  constructor(device, name, propertyDescription) {
    super(device, name, propertyDescription);

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

  /**
   * Set the value of the property.
   *
   * @param {*} value The new value to set
   * @returns a promise which resolves to the updated value.
   *
   * @note it is possible that the updated value doesn't match
   * the value passed in.
   */
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

class RadioDevice extends Device {
  constructor(adapter, id, deviceDescription) {
    super(adapter, id);

    this.fsapi = new FSAPI("192.168.0.102", "1234");

    this.name = deviceDescription.name;
    this.type = deviceDescription.type;
    this['@type'] = deviceDescription['@type'];
    this.description = deviceDescription.description;
    for (const propertyName in deviceDescription.properties) {
      const propertyDescription = deviceDescription.properties[propertyName];
      const property = new PowerProperty(this, propertyName,
                                           propertyDescription);
      this.properties.set(propertyName, property);
    }

    if (FrontierSiliconAPIHandler) {
      //TODO link to webpage
      /*this.links.push({
        rel: 'alternate',
        mediaType: 'text/html',
        // eslint-disable-next-line max-len
        href: `/extensions/frontier-silicon-adapter?thingId=${encodeURIComponent(this.id)}`,
      });*/
      this.links.push({
        rel: 'alternate',
        mediaType: 'text/html',
        // eslint-disable-next-line max-len
        href: `http://${this.fsapi.ip}/`,
      });
    }
  }
}

class FrontierSiliconAdapter extends Adapter {
  constructor(addonManager, manifest) {
    super(addonManager, 'FrontierSiliconAdapter', manifest.name);
    addonManager.addAdapter(this);

    //TODO edit
    //if (!this.devices['frontier-silicon-radio-0.0.0.0']) {
      const device = new RadioDevice(this, 'frontier-silicon-radio-0.0.0.2', {
        name: 'Radio',
        '@type': ['OnOffSwitch'],
        description: 'FrontierSilicon Internet Radio',
        properties: {
          on: {
            '@type': 'OnOffProperty',
            label: 'On/Off',
            name: 'on',
            type: 'boolean',
            value: false,
          },
        },
      });

      this.handleDeviceAdded(device);
    //}

    if (FrontierSiliconAPIHandler) {
      this.apiHandler = new FrontierSiliconAPIHandler(addonManager, this);
    }
  }

  /**
   * FrontierSilicon process to add a new device to the adapter.
   *
   * The important part is to call: `this.handleDeviceAdded(device)`
   *
   * @param {String} deviceId ID of the device to add.
   * @param {String} deviceDescription Description of the device to add.
   * @return {Promise} which resolves to the device added.
   */
  addDevice(deviceId, deviceDescription) {
    console.log("addDevice!");
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

  /**
   * FrontierSilicon process to remove a device from the adapter.
   *
   * The important part is to call: `this.handleDeviceRemoved(device)`
   *
   * @param {String} deviceId ID of the device to remove.
   * @return {Promise} which resolves to the device removed.
   */
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

  /**
   * Start the pairing/discovery process.
   *
   * @param {Number} timeoutSeconds Number of seconds to run before timeout
   */
  startPairing(_timeoutSeconds) {
    console.log('FrontierSiliconAdapter:', this.name,
                'id', this.id, 'pairing started');
  }

  /**
   * Cancel the pairing/discovery process.
   */
  cancelPairing() {
    console.log('FrontierSiliconAdapter:', this.name, 'id', this.id,
                'pairing cancelled');
  }

  /**
   * Unpair the provided the device from the adapter.
   *
   * @param {Object} device Device to unpair with
   */
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

  /**
   * Cancel unpairing process.
   *
   * @param {Object} device Device that is currently being paired
   */
  cancelRemoveThing(device) {
    console.log('FrontierSiliconAdapter:', this.name, 'id', this.id,
                'cancelRemoveThing(', device.id, ')');
  }
}

module.exports = FrontierSiliconAdapter;
