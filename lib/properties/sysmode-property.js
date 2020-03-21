'use strict';

const {_Adapter, _Database, _Device, Property} = require('gateway-addon');

class SysmodeProperty extends Property {
  constructor(device, sysmodelist) {
    super(device, 'netremote.sys.mode', {
      label: device.adapter.config.emojis ? ' ' : 'Mode',
      type: 'string',
      enum: sysmodelist,
      value: '',
    });
    this.device = device;
    this.sysmodelist = sysmodelist;
  }

  // update value by querying 'netremote.sys.mode' property
  update() {
    this.device.fsapi.get('netremote.sys.mode', ((data) => {
      this.updateValue(data);
    }).bind(this));
  }

  // update value (given in 'netremote.sys.mode' format)
  updateValue(value) {
    this.setValue(this.sysmodelist[parseInt(value)], false);
  }

  // set value (given as string of sysmodelist)
  // if update: set fsapi (in 'netremote.sys.mode' format)
  setValue(value, update = true) {
    return new Promise(((resolve, reject) => {
      super.setValue(value).then(((updatedValue) => {
        if (update)
          this.device.fsapi.set('netremote.sys.mode', `${this.sysmodelist.indexOf(updatedValue)}`);
        this.device.notifyPropertyChanged(this);

        resolve(updatedValue);
      }).bind(this)).catch(((err) => {
        reject(err);
      }).bind(this));
    }).bind(this));
  }
}

module.exports = SysmodeProperty;
