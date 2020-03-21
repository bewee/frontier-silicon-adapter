'use strict';

const {_Adapter, _Database, _Device, Property} = require('gateway-addon');
const fs = require('fs');
const mkdirp = require('mkdirp');
const {_getMediaPath, saveImageTo} = require('../helpers');

class CoverProperty extends Property {
  constructor(device) {
    super(device, 'cover', {
      '@type': 'ImageProperty',
      label: device.adapter.config.emojis ? ' ' : 'Cover',
      type: 'null',
      readOnly: true,
      links: [
        {
          rel: 'alternate',
          href: `/media/frontier-silicon/${device.id}/cover.jpg`,
          mediaType: 'image/jpeg',
        },
      ],
    });
    this.device = device;

    if (fs.existsSync(this.device.coverPath))
      fs.unlinkSync(this.device.coverPath);
    saveImageTo(this.device.adapter.config.altcover, this.device.coverPath);
  }

  updateCover() {
    this.device.fsapi.get('netRemote.play.info.graphicUri', ((url) => {
      if (!url || url==='') {
        console.log(this.device.id, 'No cover provided');
        saveImageTo(this.device.adapter.config.altcover, this.device.coverPath, ((err) => {
          console.error(this.device.id, err);
          fs.unlinkSync(this.device.coverPath);
        }).bind(this));
        return;
      }
      console.log(this.device.id, 'Loading cover', url);
      if (!fs.existsSync(this.device.mediaDir)) {
        mkdirp.sync(this.device.mediaDir, {mode: 0o755});
      }
      saveImageTo(url, this.device.coverPath, ((err) => {
        console.log(this.device.id, err);
        saveImageTo(this.device.adapter.config.altcover, this.device.coverPath, ((err) => {
          console.error(this.device.id, err);
          fs.unlinkSync(this.device.coverPath);
        }).bind(this));
      }).bind(this));
    }).bind(this));
  }
}

module.exports = CoverProperty;
