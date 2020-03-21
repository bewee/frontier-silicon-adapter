'use strict';

const {_Adapter, _Database, _Device, Property} = require('gateway-addon');

class VolumeProperty extends Property {
  constructor(device, maxvolume) {
    super(device, 'netremote.sys.audio.volume', {
      '@type': 'LevelProperty',
      label: device.adapter.config.emojis ? '🔊' : 'Volume',
      type: 'number',
      minimum: 0,
      maximum: maxvolume,
      value: 0,
    });
    this.device = device;
  }

  // update value by querying 'netremote.sys.audio.volume' property
  update() {
    this.device.fsapi.get('netremote.sys.audio.volume', ((data) => {
      this.updateValue(data);
    }).bind(this));
  }

  // update value (given in 'netremote.sys.audio.volume' format)
  updateValue(value) {
    this.setValue(parseInt(value), false);
  }

  // set value (given as number)
  // if update: set fsapi (in 'netremote.sys.audio.volume' format)
  setValue(value, update = true) {
    return new Promise(((resolve, reject) => {
      super.setValue(value).then(((updatedValue) => {
        if (update)
          this.device.fsapi.set('netremote.sys.audio.volume', `${updatedValue}`);
        this.device.notifyPropertyChanged(this);

        // update mute state
        this.device.properties.get('muted').updateValue(value==0?'1':'0');

        resolve(updatedValue);
      }).bind(this)).catch(((err) => {
        reject(err);
      }).bind(this));
    }).bind(this));
  }
}

module.exports = VolumeProperty;
