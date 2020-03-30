'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const request = require('request');

function getMediaPath() {
  let profileDir;
  if (process.env.hasOwnProperty('MOZIOT_HOME')) {
    profileDir = process.env.MOZIOT_HOME;
  } else {
    profileDir = path.join(os.homedir(), '.mozilla-iot');
  }
  return path.join(profileDir, 'media', 'frontier-silicon');
}

function saveImageTo(url, path, cb) {
  request.head(url, () => {
    request(url).pipe(fs.createWriteStream(path)).on('close', cb);
  });
}

module.exports = {getMediaPath: getMediaPath, saveImageTo: saveImageTo};
