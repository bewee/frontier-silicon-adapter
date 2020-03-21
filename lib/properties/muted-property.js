'use strict';

const {_Adapter, _Database, _Device, Property} = require('gateway-addon');

class MutedProperty extends Property {
  constructor(device) {
    super(device, 'muted', {
      label: device.adapter.config.emojis ? '🔇' : 'Muted',
      type: 'boolean',
      value: false,
    });
    this.device = device;
  }

  // update value by querying 'netremote.sys.audio.mute' and, if not '1', querying 'netremote.sys.audio.volume' and comparing result to 0
  update() {
    this.device.fsapi.get('netremote.sys.audio.mute', ((data) => {
      if (data==='1') {
        this.updateValue('1');
      } else {
        this.device.fsapi.get('netremote.sys.audio.volume', ((data) => {
          this.updateValue(data==='0' ? '1' : '0');
        }).bind(this));
      }
    }).bind(this));
  }

  // update value (given in string format)
  updateValue(value) {
    this.setValue(parseInt(value)?true:false, false);
  }

  // set value (given as boolean)
  // if update: set fsapi (in string format)
  setValue(value, update = true) {
    return new Promise(((resolve, reject) => {
      super.setValue(value).then(((updatedValue) => {
        if (update)
          this.device.fsapi.set('netremote.sys.audio.mute', updatedValue?'1':'0');
        this.device.notifyPropertyChanged(this);

        resolve(updatedValue);
      }).bind(this)).catch(((err) => {
        reject(err);
      }).bind(this));
    }).bind(this));
  }
}

module.exports = MutedProperty;
