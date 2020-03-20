'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const {createCanvas, loadImage} = require('canvas');

function getMediaPath() {
  let profileDir;
  if (process.env.hasOwnProperty('MOZIOT_HOME')) {
    profileDir = process.env.MOZIOT_HOME;
  } else {
    profileDir = path.join(os.homedir(), '.mozilla-iot');
  }

  return path.join(profileDir, 'media', 'frontier-silicon');
}

function saveImageTo(url, path, ecb) {
  loadImage(url).then((img) => {
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, img.width, img.height);
    const base64Data = canvas.toDataURL().replace(/^data:image\/png;base64,/, '');
    fs.writeFile(path, base64Data, 'base64', (err) => {
      if (err && ecb) ecb(err);
    });
  }).catch((err) => {
    if (ecb) ecb(err);
  });
}

module.exports = {getMediaPath, saveImageTo};
