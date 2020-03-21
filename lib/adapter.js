'use strict';

const {Adapter, Database, _Device, _Property} = require('gateway-addon');
const SSDPClient = require('node-ssdp').Client;
const manifest = require('../manifest.json');
const FSAPI = require('./fsapi');
const RadioDevice = require('./device');

class FrontierSiliconAdapter extends Adapter {
  constructor(addonManager) {
    super(addonManager, 'FrontierSiliconAdapter', manifest.id);
    addonManager.addAdapter(this);
    this.devices_by_ip = {};

    this.db = new Database(this.packageName);
    this.db.open().then((() => {
      return this.db.loadConfig();
    }).bind(this)).then(((config) => {
      this.config = config;
      return Promise.resolve();
    }).bind(this)).then((() => {
      this.startDiscovery();
    }).bind(this)).catch(console.error);
  }

  startDiscovery() {
    this.ssdpclient = new SSDPClient();
    this.ssdpclient.on('response', ((headers, statusCode, rinfo) => {
      if (statusCode == 200) {
        if (!this.devices_by_ip[rinfo.address]) {
          const fsapi = new FSAPI(rinfo.address, this.config.pin);
          fsapi.get('netRemote.sys.info.radioId', ((radioId) => {
            fsapi.get('netRemote.sys.caps.volumeSteps', ((maxvolume) => {
              fsapi.getlist_sysmodes(((list) => {
                const device = new RadioDevice(this, `frontier-silicon-${radioId}`, rinfo.address, headers['SPEAKER-NAME'], list, parseInt(maxvolume));
                this.devices_by_ip[device.ip] = device;
                this.handleDeviceAdded(device);
              }).bind(this));
            }).bind(this));
          }).bind(this));
        } else {
          const d = this.devices_by_ip[rinfo.address];
          d.revive();
        }
      }
    }).bind(this));
    this.search();
    setInterval((() => {
      this.search();
    }).bind(this), this.config.ssdpPollInterval);
  }

  search() {
    this.ssdpclient.search('urn:schemas-frontier-silicon-com:undok:fsapi:1');
    //this.ssdpclient.search('urn:schemas-frontier-silicon-com:fs_reference:fsapi:1');
    //this.ssdpclient.search('ssdp:all');
  }

  startPairing(_timeoutSeconds) {
    console.log('pairing started');
    this.search();
  }

  cancelPairing() {
    console.log('pairing cancelled');
  }

  removeThing(device) {
    console.log('removeThing(', device.id, ')');

    this.handleDeviceRemoved(device);
    device.dead = true;
    delete this.devices_by_ip[device.ip];
  }

  cancelRemoveThing(device) {
    console.log('cancelRemoveThing(', device.id, ')');
  }
}

module.exports = FrontierSiliconAdapter;
