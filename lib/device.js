'use strict';

const {_Adapter, _Database, Device, Property} = require('gateway-addon');
const FSAPI = require('./fsapi');
const path = require('path');
const RadioProperty = require('./radio-property');
const RadioPlayingProperty = require('./radio-playing-property');
const RadioInfoProperty = require('./radio-info-property');
const {getMediaPath, _saveImageTo} = require('./helpers');

class RadioDevice extends Device {
  constructor(adapter, id, ip, name, sysmodelist, maxvolume) {
    super(adapter, id);
    this.ip = ip;
    this.actionsfn = [];

    this.mediaDir = path.join(getMediaPath(), this.id);
    this.coverPath = path.join(this.mediaDir, 'cover.jpg');

    const _self = this;
    this.fsapi = new FSAPI(this.ip, _self.adapter.config.pin, () => {
      if ('dead' in _self) return;
      _self.connectedNotify(false);
      console.log(_self.id, 'Trying to reconnect!');
      _self.fsapi.connect((stat) => {
        _self.connectedNotify(stat);
      });
    });
    this.fsapi.connect(() => {
      _self.connectedNotify(true);
    });

    const deviceDescription = {
      name: name,
      '@type': ['OnOffSwitch'],
      description: `${name} Internet Radio`,
      properties: {
        'netremote.sys.power': {
          '@type': 'OnOffProperty',
          label: this.adapter.config.emojis ? '🔌' : 'On/Off', // ⚡?
          name: 'on',
          type: 'boolean',
          value: false,
        },
        'netremote.play.control': {
          label: this.adapter.config.emojis ? '⏯' : 'Play/Pause',
          name: 'playing',
          type: 'boolean',
          value: false,
        },
        'netremote.sys.audio.mute': {
          label: this.adapter.config.emojis ? '🔇' : 'Mutde',
          name: 'muted',
          type: 'boolean',
          value: false,
        },
        'netremote.play.repeat': {
          label: this.adapter.config.emojis ? '🔁' : 'Loop',
          name: 'repeat',
          type: 'boolean',
          value: false,
        },
        'netremote.play.shuffle': {
          label: this.adapter.config.emojis ? '🔀' : 'Shuffle',
          name: 'shuffle',
          type: 'boolean',
          value: false,
        },
        'netremote.sys.audio.volume': {
          '@type': 'LevelProperty',
          label: this.adapter.config.emojis ? '🔊' : 'Volume',
          name: 'volume',
          type: 'integer',
          minimum: 0,
          maximum: maxvolume,
          value: maxvolume/4,
        },
        'netremote.sys.mode': {
          label: this.adapter.config.emojis ? ' ' : 'Mode',
          name: 'sysmode',
          type: 'string',
          enum: sysmodelist,
          value: '',
        },
        'netremote.play.info.*': {
          label: this.adapter.config.emojis ? ' ' : 'Info',
          name: 'info',
          type: 'string',
          value: '',
          readOnly: true,
        },
        cover: {
          '@type': 'ImageProperty',
          label: this.adapter.config.emojis ? ' ' : 'Cover',
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
      title: this.adapter.config.emojis ? '⏮' : 'Previous',
      description: 'Skip to the previous track',
    });
    this.actionsfn.previous = this.fsapi.action_previous.bind(this.fsapi);
    this.addAction('next', {
      title: this.adapter.config.emojis ? '⏭' : 'Previous',
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

module.exports = RadioDevice;
