'use strict';

const Property = require('gateway-addon').Property;

class FrequencyProperty extends Property {
  constructor(device) {
    super(device, 'netremote.play.frequency', {
      '@type': 'LevelProperty',
      label: device.adapter.config.emojis ? '📶' : 'Frequency (MHz)',
      type: 'number',
      minimum: 87.5,
      maximum: 108,
      value: 0,
      multipleOf: 0.05,
    });
  }

  // update value by querying 'netremote.play.frequency' property
  update() {
    this.device.fsapi.get('netremote.play.frequency', ((data) => {
      this.updateValue(data);
    }).bind(this));
  }

  // update value (given in 'netremote.play.frequency' format)
  updateValue(value) {
    this.setCachedValueAndNotify(parseInt(value)/1000.0);
  }

  // set value (given as number) to fsapi (in 'netremote.play.frequency' format)
  setValue(value) {
    return new Promise(((resolve, reject) => {
      super.setValue(value).then(((updatedValue) => {
        this.device.fsapi.set('netremote.play.frequency', `${updatedValue*1000}`);
        resolve(updatedValue);
      }).bind(this)).catch(((err) => {
        if (err.startsWith('Value is not a multiple of: ')) {
          const f = Math.round(value*20)/20.0;
          this.device.fsapi.set('netremote.play.frequency', `${f*1000}`);
          resolve(f);
        }
        reject(err);
      }).bind(this));
    }).bind(this));
  }
}

module.exports = FrequencyProperty;
