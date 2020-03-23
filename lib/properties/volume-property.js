'use strict';

const Property = require('gateway-addon').Property;

class VolumeProperty extends Property {
  constructor(device, maxvolume) {
    super(device, 'netremote.sys.audio.volume', {
      '@type': 'LevelProperty',
      label: device.adapter.config.emojis ? '🔊' : 'Volume',
      type: 'integer',
      minimum: 0,
      maximum: maxvolume,
      value: 0,
    });
  }

  // update value by querying 'netremote.sys.audio.volume' property
  update() {
    this.device.fsapi.get('netremote.sys.audio.volume', ((data) => {
      this.updateValue(data);
    }).bind(this));
  }

  // update value (given in 'netremote.sys.audio.volume' format)
  updateValue(value) {
    this.setCachedValueAndNotify(parseInt(value));
  }

  setCachedValue(value) {
    super.setCachedValue(value);
    this.device.properties.get('muted').setCachedValueAndNotify(value==0); // update mute state
  }

  // set value (given as number) to fsapi (in 'netremote.sys.audio.volume' format)
  setValue(value) {
    return new Promise(((resolve, reject) => {
      super.setValue(value).then(((updatedValue) => {
        this.device.fsapi.set('netremote.sys.audio.volume', `${updatedValue}`);
        resolve(updatedValue);
      }).bind(this)).catch(((err) => {
        reject(err);
      }).bind(this));
    }).bind(this));
  }
}

module.exports = VolumeProperty;
