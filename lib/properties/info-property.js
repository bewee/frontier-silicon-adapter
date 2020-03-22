'use strict';

const {_Adapter, _Database, _Device, Property} = require('gateway-addon');

class InfoProperty extends Property {
  constructor(device) {
    super(device, 'info', {
      label: device.adapter.config.emojis ? ' ' : 'Info',
      type: 'string',
      value: '',
      readOnly: true,
    });
  }

  update() {
    this.device.fsapi.get('netremote.play.info.name', ((name) => {
      name = `${name.trim()}\n`;
      this.device.fsapi.get('netremote.play.info.text', ((text) => {
        text = `${text.trim()}\n`;
        this.device.fsapi.get('netremote.play.info.artist', ((artist) => {
          artist = `Artist: ${artist.trim()}\n`;
          this.device.fsapi.get('netremote.play.info.album', ((album) => {
            album = `Album: ${album.trim()}\n`;
            this.setCachedValueAndNotify(`${name!=='\n'?name:''}${text!=='\n'?text:''}${artist!=='Artist: \n'?artist:''}${album!=='Album: \n'?album:''}`);
            this.device.properties.get('cover').updateCover();
          }).bind(this));
        }).bind(this));
      }).bind(this));
    }).bind(this));
  }
}

module.exports = InfoProperty;
