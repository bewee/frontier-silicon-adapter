'use strict';

const Property = require('gateway-addon').Property;

class SpotifyuserProperty extends Property {
  constructor(device) {
    super(device, 'spotifyuser', {
      label: device.adapter.config.emojis ? '👤' : 'User',
      type: 'string',
      readOnly: true,
    });
  }

  // update value by querying 'netremote.spotify.username' property
  update() {
    this.device.fsapi.get('netremote.spotify.username', ((data) => {
      this.updateValue(data);
    }).bind(this));
  }

  // update value (given in 'netremote.spotify.username' format)
  updateValue(value) {
    this.setCachedValueAndNotify(value);
  }
}

module.exports = SpotifyuserProperty;
