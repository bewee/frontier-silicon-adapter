'use strict';

const Property = require('gateway-addon').Property;

class PowerProperty extends Property {
  constructor(device) {
    super(device, 'netremote.sys.power', {
      '@type': 'OnOffProperty',
      label: device.adapter.config.emojis ? '🔌' : 'On/Off', // ⚡?
      type: 'boolean',
      value: false,
    });
  }

  // update value by querying 'netremote.sys.power' property
  update() {
    this.device.fsapi.get('netremote.sys.power', ((data) => {
      this.updateValue(data);
    }).bind(this));
  }

  // update value (given in 'netremote.sys.power' format)
  updateValue(value) {
    this.setCachedValueAndNotify(parseInt(value)?true:false);
  }

  // set value (given as boolean) to fsapi (in 'netremote.sys.power' format)
  setValue(value) {
    return new Promise(((resolve, reject) => {
      super.setValue(value).then(((updatedValue) => {
        this.device.fsapi.set('netremote.sys.power', updatedValue?'1':'0');
        resolve(updatedValue);
      }).bind(this)).catch(((err) => {
        reject(err);
      }).bind(this));
    }).bind(this));
  }
}

module.exports = PowerProperty;
