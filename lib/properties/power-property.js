'use strict';

const {_Adapter, _Database, _Device, Property} = require('gateway-addon');

class PowerProperty extends Property {
  constructor(device) {
    super(device, 'netremote.sys.power', {
      '@type': 'OnOffProperty',
      label: device.adapter.config.emojis ? '🔌' : 'On/Off', // ⚡?
      type: 'boolean',
      value: false,
    });
    this.device = device;
  }

  // update value by querying 'netremote.sys.power' property
  update() {
    this.device.fsapi.get('netremote.sys.power', ((data) => {
      this.updateValue(data);
    }).bind(this));
  }

  // update value (given in 'netremote.sys.power' format)
  updateValue(value) {
    this.setValue(parseInt(value)?true:false, false);
  }

  // set value (given as boolean)
  // if update: set fsapi (in 'netremote.sys.power' format)
  setValue(value, update = true) {
    return new Promise(((resolve, reject) => {
      super.setValue(value).then(((updatedValue) => {
        if (update)
          this.device.fsapi.set('netremote.sys.power', updatedValue?'1':'0');
        this.device.notifyPropertyChanged(this);

        resolve(updatedValue);
      }).bind(this)).catch(((err) => {
        reject(err);
      }).bind(this));
    }).bind(this));
  }
}

module.exports = PowerProperty;
