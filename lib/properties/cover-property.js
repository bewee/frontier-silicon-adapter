'use strict';

const Property = require('gateway-addon').Property;
const path = require('path');
const saveImageTo = require('../helpers').saveImageTo;

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
          href: '',
          mediaType: '',
        },
      ],
      forms: [
        {
          href: '',
          contentType: '',
        },
      ],
    });
    this.updateImage(this.device.adapter.config.altcover);
  }

  updateCover() {
    this.device.fsapi.get('netRemote.play.info.graphicUri', ((url) => {
      if (!url || url==='') {
        console.log(this.device.id, 'No cover provided');
        this.updateImage(this.device.adapter.config.altcover);
        return;
      }
      console.log(this.device.id, 'Loading cover', url);
      this.updateImage(url);
    }).bind(this));
  }

  updateImage(url) {
    let filename;
    if (this.links) {
      if (url.toLowerCase().endsWith('.png')) {
        this.links[0].mediaType = 'image/png';
        filename = 'cover.png';
      } else if (url.toLowerCase().endsWith('.gif')) {
        this.links[0].mediaType = 'image/gif';
        filename = 'cover.gif';
      } else {
        this.links[0].mediaType = 'image/jpeg';
        filename = 'cover.jpg';
      }
      this.links[0].href = `/media/frontier-silicon/${this.device.id}/${filename}`;
    }
    if (this.forms) {
      if (url.toLowerCase().endsWith('.png')) {
        this.forms[0].contentType = 'image/png';
        filename = 'cover.png';
      } else if (url.toLowerCase().endsWith('.gif')) {
        this.forms[0].contentType = 'image/gif';
        filename = 'cover.gif';
      } else {
        this.forms[0].contentType = 'image/jpeg';
        filename = 'cover.jpg';
      }
      this.forms[0].href = `/media/frontier-silicon/${this.device.id}/${filename}`;
    }
    saveImageTo(url, path.join(this.device.mediaDir, filename), () => {
      this.device.adapter.handleDeviceUpdated(this.device);
    });
  }
}

module.exports = CoverProperty;
