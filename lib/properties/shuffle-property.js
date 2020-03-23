'use strict';

const Property = require('gateway-addon').Property;

class ShuffleProperty extends Property {
  constructor(device) {
    super(device, 'netremote.play.shuffle', {
      label: device.adapter.config.emojis ? '🔀' : 'Shuffle',
      type: 'boolean',
      value: false,
    });
  }

  // update value by querying 'netremote.play.shuffle' property
  update() {
    this.device.fsapi.get('netremote.play.shuffle', ((data) => {
      this.updateValue(data);
    }).bind(this));
  }

  // update value (given in 'netremote.play.shuffle' format)
  updateValue(value) {
    this.setCachedValueAndNotify(parseInt(value)?true:false);
  }

  // set value (given as boolean) to fsapi (in 'netremote.play.shuffle' format)
  setValue(value) {
    return new Promise(((resolve, reject) => {
      super.setValue(value).then(((updatedValue) => {
        this.device.fsapi.set('netremote.play.shuffle', updatedValue?'1':'0');
        resolve(updatedValue);
      }).bind(this)).catch(((err) => {
        reject(err);
      }).bind(this));
    }).bind(this));
  }
}

module.exports = ShuffleProperty;
