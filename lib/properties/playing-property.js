'use strict';

const {_Adapter, _Database, _Device, Property} = require('gateway-addon');

// netremote.play.control: 0=Stop; 1=Play; 2=Pause; 3=Next (song/station); 4=Previous (song/station)
// netremote.play.status: 1=buffering/loading; 2=playing; 3=paused
class PlayingProperty extends Property {
  constructor(device) {
    super(device, 'netremote.play.status', {
      label: device.adapter.config.emojis ? '⏯' : 'Play/Pause',
      type: 'boolean',
      value: false,
    });
    this.device = device;
  }

  // update value by querying 'netremote.play.status'
  update() {
    this.device.fsapi.get('netremote.play.status', ((data) => {
      this.updateValue(data);
    }).bind(this));
  }

  // update value (given in 'netremote.play.status' format)
  updateValue(value) {
    this.setValue(!(value === '1' || value === '3'), false);
    if (value == '2')
      this.device.properties.get('netremote.sys.power').updateValue('1');
  }

  // set value (given as boolean)
  // if update: set fsapi (in 'netremote.play.control' format)
  setValue(value, update = true) {
    return new Promise(((resolve, reject) => {
      super.setValue(value).then(((updatedValue) => {
        if (update)
          this.device.fsapi.set('netremote.play.control', value ? '1' : '2');
        this.device.notifyPropertyChanged(this);

        resolve(updatedValue);
      }).bind(this)).catch(((err) => {
        reject(err);
      }).bind(this));
    }).bind(this));
  }
}

module.exports = PlayingProperty;
