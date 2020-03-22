'use strict';

const {_Adapter, _Database, _Device, Property} = require('gateway-addon');

class SysmodeProperty extends Property {
  constructor(device, sysmodelist) {
    const labellist = sysmodelist.filter((x) => (x.selectable)).map((x) => (x.label));
    super(device, 'netremote.sys.mode', {
      label: device.adapter.config.emojis ? ' ' : 'Mode',
      type: 'string',
      enum: labellist,
      value: '',
    });
    this.sysmodelist = sysmodelist;
  }

  setCachedValue(value) {
    super.setCachedValue(value);
    setTimeout((() => {
      switch (this.sysmodelist.find((x) => (x.label===value)).id) {
        case 'IR': // Internet Radio
          this.device.setVisibility(['netremote.sys.power', 'netremote.sys.mode', 'netremote.sys.audio.volume', 'muted', 'info', 'cover']);
          break;
        case 'Spotify': // Spotify
          this.device.setVisibility(['netremote.sys.power', 'netremote.sys.mode', 'netremote.sys.audio.volume', 'muted', 'netremote.play.status', 'netremote.play.repeat', 'netremote.play.shuffle', 'info', 'cover', 'previous', 'next']);
          break;
        case 'DMR': // DMR
          this.device.setVisibility(['netremote.sys.power', 'netremote.sys.mode', 'netremote.sys.audio.volume', 'muted', 'netremote.play.status', 'info', 'cover']);
          break;
        case 'MP': // USB and Network
          this.device.setVisibility(['netremote.sys.power', 'netremote.sys.mode', 'netremote.sys.audio.volume', 'muted', 'netremote.play.status', 'netremote.play.repeat', 'netremote.play.shuffle', 'info', 'cover', 'previous', 'next']);
          break;
        case 'DAB': // DAB
          this.device.setVisibility(['netremote.sys.power', 'netremote.sys.mode', 'netremote.sys.audio.volume', 'muted', 'info', 'previous', 'next']);
          break;
        case 'FM': // FM
          this.device.setVisibility(['netremote.sys.power', 'netremote.sys.mode', 'netremote.sys.audio.volume', 'muted', 'info', 'previous', 'next']);
          break;
        case 'BLUETOOTH': // Bluetooth
          this.device.setVisibility(['netremote.sys.power', 'netremote.sys.mode', 'netremote.sys.audio.volume', 'muted']);
          break;
        case 'AUXIN': // AUX input
          this.device.setVisibility(['netremote.sys.power', 'netremote.sys.mode', 'netremote.sys.audio.volume', 'muted']);
          break;
        default:
          this.device.setVisibility(['netremote.sys.power', 'netremote.sys.mode', 'netremote.sys.audio.volume', 'muted']);
          break;
      }
      this.device.adapter.handleDeviceUpdated(this.device);
    }).bind(this), 100);
  }

  // update value by querying 'netremote.sys.mode' property
  update() {
    this.device.fsapi.get('netremote.sys.mode', ((data) => {
      this.updateValue(data);
    }).bind(this));
  }

  // update value (given in 'netremote.sys.mode' format)
  updateValue(value) {
    if ('resetenum' in this) {
      this.enum = this.sysmodelist.filter((x) => (x.selectable)).map((x) => (x.label));
      delete this.resetenum;
      this.device.adapter.handleDeviceUpdated(this.device);
    }
    const label = this.sysmodelist.find((x) => (x.n===parseInt(value))).label;
    if (!this.enum.includes(label) && this.sysmodelist.find((x) => (x.label===label))) {
      this.enum.push(label);
      this.device.adapter.handleDeviceUpdated(this.device);
      this.resetenum = true;
    }
    this.setCachedValueAndNotify(label);
  }

  // set value (given as string of enum) to fsapi (in 'netremote.sys.mode' format)
  setValue(value) {
    return new Promise(((resolve, reject) => {
      super.setValue(value).then(((updatedValue) => {
        this.device.fsapi.set('netremote.sys.mode', `${this.sysmodelist.find((x) => (x.label===value)).n}`);
        resolve(updatedValue);
      }).bind(this)).catch(((err) => {
        reject(err);
      }).bind(this));
    }).bind(this));
  }
}

module.exports = SysmodeProperty;
