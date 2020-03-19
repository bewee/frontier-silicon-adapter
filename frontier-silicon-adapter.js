'use strict';

const {
  Adapter,
  Database,
  Device,
  Property,
} = require('gateway-addon');
const SSDPClient = require('node-ssdp').Client;
const FSAPI = require('./fsapi');
const manifest = require('./manifest.json');
const os = require('os');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
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

class RadioProperty extends Property {
  constructor(device, name, propertyDescription, datatype = null, decodeobj = null, encodeobj = null, setcb = null, updatecb = null) {
    super(device, name, propertyDescription);
    this.device = device;
    this.unit = propertyDescription.unit;
    this.description = propertyDescription.description;
    //this.setCachedValue(propertyDescription.value);
    //this.device.notifyPropertyChanged(this);
    this.datatype = datatype;
    this.decodeobj = decodeobj;
    this.encodeobj = encodeobj;
    this.setcb = setcb;
    this.updatecb = updatecb;
  }

  // update value by querying property
  update() {
    const _self = this;
    this.device.fsapi.get(this.name, (data) => {
      _self.updateValue(data);
    });
  }

  // update value (given in string format)
  updateValue(value) {
    if (this.updatecb) this.updatecb(value);
    let v = null;
    if (this.datatype == 'enum') {
      if (this.decodeobj) v = this.decodeobj[value];
      else                v = this.encodeobj.indexOf(value);
    } else {
      switch (this.datatype) {
        case 'bool':
          v = parseInt(value)?true:false;
          break;
        case 'int':
          v = parseInt(value);
          break;
        default:
          v = value;
          break;
      }
    }
    this.setValue(v, false);
  }

  // sets value (given as [datatype])
  // updates fsapi in string format
  setValue(value, update = true) {
    const _self = this;
    return new Promise((resolve, reject) => {
      super.setValue(value).then((updatedValue) => {
        if (_self.setcb) _self.setcb(updatedValue);
        if (update) {
          let v = null;
          if (_self.datatype == 'enum') {
            if (_self.encodeobj) v = _self.encodeobj[updatedValue];
            else                 v = _self.decodeobj.indexOf(updatedValue);
          } else {
            switch (_self.datatype) {
              case 'bool':
                v = updatedValue?'1':'0';
                break;
              case 'int':
                v = `${updatedValue}`;
                break;
              default:
                v = updatedValue;
                break;
            }
          }
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

class RadioInfoProperty extends Property {
  constructor(device, name, propertyDescription) {
    super(device, name, propertyDescription);
    this.device = device;
    this.unit = propertyDescription.unit;
    this.description = propertyDescription.description;

    if (fs.existsSync(this.device.coverPath))
      fs.unlinkSync(this.device.coverPath);
    saveImageTo('https://cdn.pixabay.com/photo/2012/04/01/19/05/note-24074_960_720.png', this.device.coverPath);
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
                console.log(_self.id, 'No cover provided');
                saveImageTo('https://cdn.pixabay.com/photo/2012/04/01/19/05/note-24074_960_720.png', _self.device.coverPath, (err) => {
                  console.error(_self.id, err);
                  fs.unlinkSync(_self.device.coverPath);
                });
                return;
              }
              console.log(_self.id, 'Loading cover', url);
              if (!fs.existsSync(_self.device.mediaDir)) {
                mkdirp.sync(_self.device.mediaDir, {mode: 0o755});
              }
              saveImageTo(url, _self.device.coverPath, (err) => {
                console.log(_self.id, err);
                saveImageTo('https://cdn.pixabay.com/photo/2012/04/01/19/05/note-24074_960_720.png', _self.device.coverPath, (err) => {
                  console.error(_self.id, err);
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

class RadioDevice extends Device {
  constructor(adapter, id, ip, name, sid, sysmodelist, maxvolume) {
    super(adapter, id);
    this.ip = ip;
    this.actionsfn = [];

    this.mediaDir = path.join(getMediaPath(), this.id);
    this.coverPath = path.join(this.mediaDir, 'cover.jpg');

    const _self = this;
    this.fsapi = new FSAPI(this.ip, _self.adapter.config.pin, sid, null, () => {
      if ('dead' in _self) return;
      _self.connectedNotify(false);
      console.log(_self.id, 'Trying to reconnect!');
      _self.fsapi.connect((stat) => {
        _self.connectedNotify(stat);
      });
    });

    const deviceDescription = {
      name: name,
      '@type': ['OnOffSwitch'],
      description: `${name} Internet Radio`,
      properties: {
        'netremote.sys.power': {
          '@type': 'OnOffProperty',
          label: 'On/Off',
          name: 'on',
          type: 'boolean',
          value: false,
        },
        'netremote.play.control': {
          label: '⏯',
          name: 'playing',
          type: 'boolean',
          value: false,
        },
        'netremote.sys.audio.mute': {
          label: '🔇',
          name: 'muted',
          type: 'boolean',
          value: false,
        },
        'netremote.play.repeat': {
          label: '🔁',
          name: 'repeat',
          type: 'boolean',
          value: false,
        },
        'netremote.play.shuffle': {
          label: '🔀',
          name: 'shuffle',
          type: 'boolean',
          value: false,
        },
        'netremote.sys.audio.volume': {
          '@type': 'LevelProperty',
          label: '🔊',
          name: 'volume',
          type: 'integer',
          minimum: 0,
          maximum: maxvolume,
          value: maxvolume/4,
        },
        'netremote.sys.mode': {
          label: 'Mode',
          name: 'sysmode',
          type: 'string',
          enum: sysmodelist,
          value: '',
        },
        'netremote.play.info.*': {
          label: 'Info',
          name: 'info',
          type: 'string',
          value: '',
          readOnly: true,
        },
        cover: {
          '@type': 'ImageProperty',
          label: 'Cover',
          name: 'cover',
          type: 'null',
          readOnly: true,
          links: [
            {
              rel: 'alternate',
              href: `/media/frontier-silicon/${this.id}/cover.jpg`,
              mediaType: 'image/jpeg',
            },
          ],
        },
      },
    };

    this.name = deviceDescription.name;
    this.type = deviceDescription.type;
    this['@type'] = deviceDescription['@type'];
    this.description = deviceDescription.description;

    const powerProperty = new RadioProperty(this, 'netremote.sys.power', deviceDescription.properties['netremote.sys.power'], 'bool');
    this.properties.set('netremote.sys.power', powerProperty);
    const volumeProperty = new RadioProperty(this, 'netremote.sys.audio.volume', deviceDescription.properties['netremote.sys.audio.volume'], 'int', null, null, (val) => {
      this.properties.get('netremote.sys.audio.mute').updateValue(val==0?'1':'0');
    });
    this.properties.set('netremote.sys.audio.volume', volumeProperty);
    const repeatProperty = new RadioProperty(this, 'netremote.play.repeat', deviceDescription.properties['netremote.play.repeat'], 'bool');
    this.properties.set('netremote.play.repeat', repeatProperty);
    const shuffleProperty = new RadioProperty(this, 'netremote.play.shuffle', deviceDescription.properties['netremote.play.shuffle'], 'bool');
    this.properties.set('netremote.play.shuffle', shuffleProperty);
    const mutedProperty = new RadioProperty(this, 'netremote.sys.audio.mute', deviceDescription.properties['netremote.sys.audio.mute'], 'bool');
    this.properties.set('netremote.sys.audio.mute', mutedProperty);
    const sysmodeProperty = new RadioProperty(this, 'netremote.sys.mode', deviceDescription.properties['netremote.sys.mode'], 'enum', sysmodelist);
    this.properties.set('netremote.sys.mode', sysmodeProperty);
    const playingProperty = new RadioPlayingProperty(this, 'netremote.play.control', deviceDescription.properties['netremote.play.control']);
    this.properties.set('netremote.play.control', playingProperty);
    const infoProperty = new RadioInfoProperty(this, 'netremote.play.info.*', deviceDescription.properties['netremote.play.info.*']);
    this.properties.set('netremote.play.info.*', infoProperty);
    const coverProperty = new Property(this, 'cover', deviceDescription.properties.cover);
    this.properties.set('cover', coverProperty);

    this.addAction('previous', {
      title: '⏮',
      description: 'Skip to the previous track',
    });
    this.actionsfn.previous = this.fsapi.action_previous.bind(this.fsapi);
    this.addAction('next', {
      title: '⏭',
      description: 'Skip to the next track',
    });
    this.actionsfn.next = this.fsapi.action_next.bind(this.fsapi);

    this.links.push({
      rel: 'alternate',
      mediaType: 'text/html',
      href: `http://${this.fsapi.ip}/`,
    });
  }

  async performAction(action) {
    action.start();
    const fn = this.actionsfn[action.name];
    if (fn)
      fn();
    else
      console.warn(this.id, `Unknown action ${action}`);
    action.finish();
  }

  revive() {
    const _self = this;
    if (!_self.connected)
      _self.fsapi.connect((stat) => {
        _self.connectedNotify(stat);
      });
  }

  connectedNotify(stat) {
    if (!('connected' in this) || stat != this.connected) {
      this.connected = stat;
      if (stat) {
        console.log(this.id, 'Connected!');
        this.updateAllProperties();
        this.detectUpdates();
      } else {
        console.log(this.id, 'Disconnected!');
      }
    }
    super.connectedNotify(stat);
  }

  updateAllProperties() {
    console.log(this.id, 'Updating all properties!');
    for (const entry of this.properties.entries()) {
      if (this.properties.get(entry[0]).update) this.properties.get(entry[0]).update();
    }
  }

  detectUpdates() {
    const _self = this;
    this.fsapi.getnotifies((list) => {
      if ('dead' in _self) return;
      console.log(_self.id, 'List of changes', list);
      for (const prop in list) {
        switch (prop) {
          case 'netremote.play.status': {
            this.properties.get('netremote.play.control').updateValue(list[prop]);
            break;
          }
          case 'netremote.play.info.name': case 'netremote.play.info.text': {
            this.properties.get('netremote.play.info.*').update();
            break;
          }
          default:
            if (this.properties.has(prop))
              this.properties.get(prop).updateValue(list[prop]);
            break;
        }
      }
      _self.detectUpdates();
    });
  }
}

class FrontierSiliconAdapter extends Adapter {
  constructor(addonManager) {
    super(addonManager, 'FrontierSiliconAdapter', manifest.id);
    addonManager.addAdapter(this);
    this.devices_by_ip = {};

    this.db = new Database(this.packageName);
    const _self = this;
    this.db.open().then(() => {
      return _self.db.loadConfig();
    }).then((config) => {
      _self.config = config;
      return Promise.resolve();
    }).then(() => {
      _self.startDiscovery();
    }).catch(console.error);
  }

  startDiscovery() {
    this.ssdpclient = new SSDPClient();
    const _self = this;
    this.ssdpclient.on('response', (headers, statusCode, rinfo) => {
      if (statusCode == 200) {
        if (!_self.devices_by_ip[rinfo.address]) {
          const fsapi = new FSAPI(rinfo.address, _self.config.pin, null, () => {
            fsapi.get('netRemote.sys.info.radioId', (radioId) => {
              fsapi.get('netRemote.sys.caps.volumeSteps', (maxvolume) => {
                fsapi.getlist_sysmodes((list) => {
                  const device = new RadioDevice(_self, `frontier-silicon-${radioId}`, rinfo.address, headers['SPEAKER-NAME'], fsapi.sid, list, parseInt(maxvolume));
                  this.devices_by_ip[device.ip] = device;
                  _self.handleDeviceAdded(device);
                });
              });
            });
          });
        } else {
          const d = _self.devices_by_ip[rinfo.address];
          d.revive();
        }
      }
    });
    this.search();
    setInterval(() => {
      _self.search();
    }, this.config.ssdpPollInterval);
  }

  search() {
    this.ssdpclient.search('urn:schemas-frontier-silicon-com:undok:fsapi:1');
    //this.ssdpclient.search('urn:schemas-frontier-silicon-com:fs_reference:fsapi:1');
    //this.ssdpclient.search('ssdp:all');
  }

  startPairing(_timeoutSeconds) {
    console.log('pairing started');
    this.search();
  }

  cancelPairing() {
    console.log('pairing cancelled');
  }

  removeThing(device) {
    console.log('removeThing(', device.id, ')');

    this.handleDeviceRemoved(device);
    device.dead = true;
    delete this.devices_by_ip[device.ip];
  }

  cancelRemoveThing(device) {
    console.log('cancelRemoveThing(', device.id, ')');
  }
}

module.exports = FrontierSiliconAdapter;
