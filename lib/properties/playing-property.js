'use strict';

const Property = require('gateway-addon').Property;

// netremote.play.control: 0=Stop; 1=Play; 2=Pause; 3=Next (song/station); 4=Previous (song/station)
// netremote.play.status: 1=buffering/loading; 2=playing; 3=paused
class PlayingProperty extends Property {
  constructor(device) {
    super(device, 'netremote.play.status', {
      label: device.adapter.config.emojis ? '⏯' : 'Play/Pause',
      type: 'boolean',
      value: false,
    });
  }

  // update value by querying 'netremote.play.status'
  update() {
    this.device.fsapi.get('netremote.play.status', ((data) => {
      this.updateValue(data);
    }).bind(this));
  }

  // update value (given in 'netremote.play.status' format)
  updateValue(value) {
    this.setCachedValueAndNotify(!(value === '1' || value === '3'), false);
    if (value == '2')
      this.device.properties.get('netremote.sys.power').setCachedValueAndNotify(true);
    if (this.device.properties.get('netremote.sys.mode').value == 'Spotify')
      this.device.properties.get('spotifyuser').update();
  }

  // set value (given as boolean) to fsapi (in 'netremote.play.control' format)
  setValue(value) {
    return new Promise(((resolve, reject) => {
      super.setValue(value).then(((updatedValue) => {
        this.device.fsapi.set('netremote.play.control', value ? '1' : '2');
        resolve(updatedValue);
      }).bind(this)).catch(((err) => {
        reject(err);
      }).bind(this));
    }).bind(this));
  }
}

module.exports = PlayingProperty;
