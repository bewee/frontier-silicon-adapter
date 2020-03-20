'use strict';

const {_Adapter, _Database, _Device, Property} = require('gateway-addon');

// netremote.play.control: 0=Stop; 1=Play; 2=Pause; 3=Next (song/station); 4=Previous (song/station)
// netremote.play.status: 1=buffering/loading; 2=playing; 3=paused
class RadioPlayingProperty extends Property {
  constructor(device, name, propertyDescription) {
    super(device, name, propertyDescription);
    this.device = device;
    this.unit = propertyDescription.unit;
    this.description = propertyDescription.description;
    //this.setCachedValue(propertyDescription.value);
    //this.device.notifyPropertyChanged(this);
  }

  // update value by querying netremote.play.control
  update() {
    const _self = this;
    this.device.fsapi.get(this.name, (data) => {
      _self.updateValue(`x${data}`);
    });
  }

  // update value (given in netremote.play.status or xnetremote.play.control format)
  updateValue(value) {
    if (value == '2')
      this.device.properties.get('netremote.sys.power').updateValue('1');
    let v = true;
    if (value.startsWith('x')) {
      if (value === 'x0' || value === 'x2')
        v = false;
    } else {
      if (value === '1' || value === '3')
        v = false;
    }
    this.setValue(v, false);
  }

  // sets value (given as boolean)
  // updates fsapi in netremote.play.control format
  setValue(value, update = true) {
    const _self = this;
    return new Promise((resolve, reject) => {
      super.setValue(value).then((updatedValue) => {
        if (update) {
          const v = value ? '1' : '2';
          _self.device.fsapi.set(_self.name, v);
        }
        resolve(updatedValue);
        _self.device.notifyPropertyChanged(_self);
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

module.exports = RadioPlayingProperty;
