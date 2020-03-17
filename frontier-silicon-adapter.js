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

class RadioProperty extends Property {
  constructor(device, name, propertyDescription, datatype = null, decodeobj = null, encodeobj = null, setcb = null, updatecb = null) {
    super(device, name, propertyDescription);
    this.device = device;
    this.unit = propertyDescription.unit;
    this.description = propertyDescription.description;
    this.setCachedValue(propertyDescription.value);
    this.device.notifyPropertyChanged(this);
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

class RadioPlayingProperty extends Property {
  constructor(device, name, propertyDescription) {
    super(device, name, propertyDescription);
    this.device = device;
    this.unit = propertyDescription.unit;
    this.description = propertyDescription.description;
    this.setCachedValue(propertyDescription.value);
    this.device.notifyPropertyChanged(this);
  }

  // update value by querying netremote.play.control
  update() {
    const _self = this;
    this.device.fsapi.get(this.name, (data) => {
      _self.updateValue(data==='2' ? '3' : '2');
    });
  }

  // update value (given in netremote.play.status format)
  updateValue(value) {
    if (value == '2')
      this.device.properties.get('netremote.sys.power').updateValue('1');
    let v = true;
    if (value === '1' || value === '3')
      v = false;
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
    this.setCachedValue(propertyDescription.value);
    this.device.notifyPropertyChanged(this);
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
          });
        });
      });
    });
  }
}

class RadioDevice extends Device {
  constructor(adapter, id, ip, name, sysmodelist, maxvolume) {
    super(adapter, id);
    this.ip = ip;
    this.actionsfn = [];

    const _self = this;
    this.fsapi = new FSAPI(this.ip, _self.adapter.config.pin, (stat) => {
      _self.connectedNotify(stat);
    }, () => {
      console.log('Disconnected! Trying to reconnect!');
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
      console.warn(`Unknown action ${action}`);
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
        console.log('Connected!');
        this.updateAllProperties();
        this.detectUpdates();
        super.connectedNotify(stat);
      } else {
        console.log('Disconnected');
      }
    } else {
      super.connectedNotify(stat);
    }
  }

  updateAllProperties() {
    console.log('Updating all properties!');
    for (const entry of this.properties.entries()) {
      if (this.properties.get(entry[0]).update) this.properties.get(entry[0]).update();
    }
  }

  detectUpdates() {
    const _self = this;
    this.fsapi.getnotifies((list) => {
      console.log('list', list);
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
        if (!_self.devices[`frontier-silicon-${rinfo.address}`]) {
          const fsapi = new FSAPI(rinfo.address, _self.config.pin, () => {
            fsapi.get('netRemote.sys.info.radioId', (radioId) => {
              fsapi.get('netRemote.sys.caps.volumeSteps', (maxvolume) => {
                fsapi.getlist_sysmodes((list) => {
                  const device = new RadioDevice(_self, `frontier-silicon-${radioId}`, rinfo.address, headers['SPEAKER-NAME'], list, parseInt(maxvolume));
                  _self.handleDeviceAdded(device);
                });
              });
            });
          });
        } else {
          const d = _self.devices[`frontier-silicon-${rinfo.address}`];
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

  removeDevice(deviceId) {
    return new Promise((resolve, reject) => {
      const device = this.devices[deviceId];
      if (device) {
        this.handleDeviceRemoved(device);
        resolve(device);
      } else {
        reject(`Device: ${deviceId} not found.`);
      }
    });
  }

  startPairing(_timeoutSeconds) {
    console.log('FrontierSiliconAdapter:', this.name,
                'id', this.id, 'pairing started');
    this.search();
  }

  cancelPairing() {
    console.log('FrontierSiliconAdapter:', this.name, 'id', this.id,
                'pairing cancelled');
  }

  removeThing(device) {
    console.log('FrontierSiliconAdapter:', this.name, 'id', this.id,
                'removeThing(', device.id, ') started');

    this.removeDevice(device.id).then(() => {
      console.log('FrontierSiliconAdapter: device:', device.id, 'was unpaired.');
    }).catch((err) => {
      console.error('FrontierSiliconAdapter: unpairing', device.id, 'failed');
      console.error(err);
    });
  }

  cancelRemoveThing(device) {
    console.log('FrontierSiliconAdapter:', this.name, 'id', this.id,
                'cancelRemoveThing(', device.id, ')');
  }
}

module.exports = FrontierSiliconAdapter;
