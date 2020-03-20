'use strict';

const {_Adapter, _Database, _Device, Property} = require('gateway-addon');
const fs = require('fs');
const mkdirp = require('mkdirp');
const {_getMediaPath, saveImageTo} = require('./helpers');

class RadioInfoProperty extends Property {
  constructor(device, name, propertyDescription) {
    super(device, name, propertyDescription);
    this.device = device;
    this.unit = propertyDescription.unit;
    this.description = propertyDescription.description;

    if (fs.existsSync(this.device.coverPath))
      fs.unlinkSync(this.device.coverPath);
    saveImageTo(this.device.adapter.config.altcover, this.device.coverPath);
  }

  update() {
    const _self = this;
    this.device.fsapi.get('netremote.play.info.name', (name) => {
      name = `${name.trim()}\n`;
      _self.device.fsapi.get('netremote.play.info.text', (text) => {
        text = `${text.trim()}\n`;
        _self.device.fsapi.get('netremote.play.info.artist', (artist) => {
          artist = `Artist: ${artist.trim()}\n`;
          _self.device.fsapi.get('netremote.play.info.album', (album) => {
            album = `Album: ${album.trim()}\n`;
            _self.setCachedValue(`${name!=='\n'?name:''}${text!=='\n'?text:''}${artist!=='Artist: \n'?artist:''}${album!=='Album: \n'?album:''}`);
            _self.device.notifyPropertyChanged(this);

            // update cover
            _self.device.fsapi.get('netRemote.play.info.graphicUri', (url) => {
              if (!url || url==='') {
                console.log(_self.device.id, 'No cover provided');
                saveImageTo(_self.device.adapter.config.altcover, _self.device.coverPath, (err) => {
                  console.error(_self.device.id, err);
                  fs.unlinkSync(_self.device.coverPath);
                });
                return;
              }
              console.log(_self.device.id, 'Loading cover', url);
              if (!fs.existsSync(_self.device.mediaDir)) {
                mkdirp.sync(_self.device.mediaDir, {mode: 0o755});
              }
              saveImageTo(url, _self.device.coverPath, (err) => {
                console.log(_self.device.id, err);
                saveImageTo(_self.device.adapter.config.altcover, _self.device.coverPath, (err) => {
                  console.error(_self.device.id, err);
                  fs.unlinkSync(_self.device.coverPath);
                });
              });
            });
          });
        });
      });
    });
  }
}

module.exports = RadioInfoProperty;
