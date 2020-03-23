'use strict';

const Property = require('gateway-addon').Property;

class RepeatProperty extends Property {
  constructor(device) {
    super(device, 'netremote.play.repeat', {
      label: device.adapter.config.emojis ? '🔁' : 'Loop',
      type: 'boolean',
      value: false,
    });
  }

  // update value by querying 'netremote.play.repeat' property
  update() {
    this.device.fsapi.get('netremote.play.repeat', ((data) => {
      this.updateValue(data);
    }).bind(this));
  }

  // update value (given in 'netremote.play.repeat' format)
  updateValue(value) {
    this.setCachedValueAndNotify(parseInt(value)?true:false);
  }

  // set value (given as boolean) to fsapi (in 'netremote.play.repeat' format)
  setValue(value) {
    return new Promise(((resolve, reject) => {
      super.setValue(value).then(((updatedValue) => {
        this.device.fsapi.set('netremote.play.repeat', updatedValue?'1':'0');
        resolve(updatedValue);
      }).bind(this)).catch(((err) => {
        reject(err);
      }).bind(this));
    }).bind(this));
  }
}

module.exports = RepeatProperty;
