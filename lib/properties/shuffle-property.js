'use strict';

const {_Adapter, _Database, _Device, Property} = require('gateway-addon');

class ShuffleProperty extends Property {
  constructor(device) {
    super(device, 'netremote.play.shuffle', {
      label: device.adapter.config.emojis ? '🔀' : 'Shuffle',
      type: 'boolean',
      value: false,
    });
    this.device = device;
  }

  // update value by querying 'netremote.play.shuffle' property
  update() {
    this.device.fsapi.get('netremote.play.shuffle', ((data) => {
      this.updateValue(data);
    }).bind(this));
  }

  // update value (given in 'netremote.play.shuffle' format)
  updateValue(value) {
    this.setValue(parseInt(value)?true:false, false);
  }

  // set value (given as boolean)
  // if update: set fsapi (in 'netremote.play.shuffle' format)
  setValue(value, update = true) {
    return new Promise(((resolve, reject) => {
      super.setValue(value).then(((updatedValue) => {
        if (update)
          this.device.fsapi.set('netremote.play.shuffle', updatedValue?'1':'0');
        this.device.notifyPropertyChanged(this);

        resolve(updatedValue);
      }).bind(this)).catch(((err) => {
        reject(err);
      }).bind(this));
    }).bind(this));
  }
}

module.exports = ShuffleProperty;
