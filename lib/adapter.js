'use strict';

const Adapter = require('gateway-addon').Adapter;
const Database = require('gateway-addon').Database;
const SSDPClient = require('node-ssdp').Client;
const manifest = require('../manifest.json');
const FSAPI = require('./fsapi');
const RadioDevice = require('./device');

class FrontierSiliconAdapter extends Adapter {
  constructor(addonManager) {
    super(addonManager, 'FrontierSiliconAdapter', manifest.id);
    addonManager.addAdapter(this);
    this.devices_by_ip = {};
    this.savedDevices = [];

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
              fsapi.get('netRemote.sys.caps.fmFreqRange.lower', ((minfreq) => {
                fsapi.get('netRemote.sys.caps.fmFreqRange.stepSize', ((stepfreq) => {
                  fsapi.get('netRemote.sys.caps.fmFreqRange.upper', ((maxfreq) => {
                    fsapi.getlist_sysmodes(((list) => {
                      const device = new RadioDevice(
                        this,
                        `frontier-silicon-${radioId}`,
                        rinfo.address, headers['SPEAKER-NAME'],
                        list,
                        parseInt(parseInt(maxvolume)*this.config.limitVolume/100),
                        parseInt(minfreq)/1000.0,
                        parseInt(stepfreq)/1000.0,
                        parseInt(maxfreq)/1000.0,
                      );
                      this.devices_by_ip[device.ip] = device;
                      this.handleDeviceAdded(device);
                      if (this.savedDevices.includes(device.id)) {
                        console.log('Thing saved later', device.id);
                        device.run();
                      }
                    }).bind(this));
                  }).bind(this));
                }).bind(this));
              }).bind(this));
            }).bind(this));
          }).bind(this));
        }
      }
    }).bind(this));
    this.search();
    setInterval((() => {
      this.search();
    }).bind(this), this.config.ssdpPollInterval*1000);
  }

  search() {
    this.ssdpclient.search('urn:schemas-frontier-silicon-com:undok:fsapi:1');
    //this.ssdpclient.search('urn:schemas-frontier-silicon-com:fs_reference:fsapi:1');
    //this.ssdpclient.search('ssdp:all');
  }

  handleDeviceAdded(device, reload = false) {
    super.handleDeviceAdded(device);
    if (reload) return;
    console.log('Thing added', device.id);
    device.connectedNotify(false);
  }

  handleDeviceUpdated(device) {
    super.handleDeviceAdded(device, true);
    console.log('Thing updated', device.id);
  }

  handleDeviceSaved(deviceId) {
    super.handleDeviceSaved(deviceId);
    this.savedDevices.push(deviceId);
    if (this.devices[deviceId]) {
      const device = this.devices[deviceId];
      console.log('Thing saved', deviceId);
      device.connectedNotify(false);
      device.run();
    }
  }

  startPairing(_timeoutSeconds) {
    console.log('pairing started');
    this.search();
  }

  cancelPairing() {
    console.log('pairing cancelled');
  }

  handleDeviceRemoved(device) {
    super.handleDeviceRemoved(device);
    device.stop();
    console.log('Thing removed', device.id);
  }

  removeThing(device) {
    console.log('removeThing(', device.id, ')');

    this.handleDeviceRemoved(device);
    delete this.devices_by_ip[device.ip];
    if (this.savedDevices.includes(device.id))
      this.savedDevices.splice(this.savedDevices.indexOf(device.id), 1);
  }

  cancelRemoveThing(device) {
    console.log('cancelRemoveThing(', device.id, ')');
  }
}

module.exports = FrontierSiliconAdapter;
