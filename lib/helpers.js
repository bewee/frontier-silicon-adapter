'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const request = require('request');

function getMediaPath(mediaDir) {
  if (mediaDir) {
    return path.join(mediaDir, 'frontier-silicon');
  }

  let profileDir;
  if (process.env.hasOwnProperty('MOZIOT_HOME')) {
    profileDir = process.env.MOZIOT_HOME;
  } else {
    profileDir = path.join(os.homedir(), '.mozilla-iot');
  }

  return path.join(profileDir, 'media', 'frontier-silicon');
}

function saveImageTo(url, pth, cb) {
  request.head(url, () => {
    fs.mkdirSync(path.dirname(pth), {recursive: true});
    request(url).pipe(fs.createWriteStream(pth)).on('close', cb);
  });
}

module.exports = {getMediaPath: getMediaPath, saveImageTo: saveImageTo};
