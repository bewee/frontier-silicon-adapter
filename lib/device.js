'use strict';

const {_Adapter, _Database, Device, _Property} = require('gateway-addon');
const FSAPI = require('./fsapi');
const path = require('path');
const PowerProperty = require('./properties/power-property');
const VolumeProperty = require('./properties/volume-property');
const RepeatProperty = require('./properties/repeat-property');
const ShuffleProperty = require('./properties/shuffle-property');
const FrequencyProperty = require('./properties/frequency-property');
const MutedProperty = require('./properties/muted-property');
const SysmodeProperty = require('./properties/sysmode-property');
const PlayingProperty = require('./properties/playing-property');
const InfoProperty = require('./properties/info-property');
const CoverProperty = require('./properties/cover-property');
const {getMediaPath, _saveImageTo} = require('./helpers');

class RadioDevice extends Device {
  constructor(adapter, id, ip, name, sysmodelist, maxvolume) {
    super(adapter, id);
    this.ip = ip;

    this.name = name;
    this['@type'] = ['OnOffSwitch'];
    this.description = `${name} Internet Radio`;

    this.actionsfn = [];
    this.mediaDir = path.join(getMediaPath(), this.id);
    this.coverPath = path.join(this.mediaDir, 'cover.jpg');

    this.fsapi = new FSAPI(this.ip, this.adapter.config.pin, (() => {
      if ('dead' in this) return;
      this.connectedNotify(false);
      console.log(this.id, 'Trying to reconnect!');
      this.run();
    }).bind(this));

    this.name = name;
    this['@type'] = ['OnOffSwitch'];
    this.description = `${name} Internet Radio`;

    this.properties.set('netremote.sys.power', new PowerProperty(this));
    this.properties.set('netremote.sys.mode', new SysmodeProperty(this, sysmodelist));
    this.properties.set('netremote.sys.audio.volume', new VolumeProperty(this, maxvolume));
    this.properties.set('muted', new MutedProperty(this));
    this.properties.set('netremote.play.status', new PlayingProperty(this));
    this.properties.set('netremote.play.repeat', new RepeatProperty(this));
    this.properties.set('netremote.play.shuffle', new ShuffleProperty(this));
    this.properties.set('netremote.play.frequency', new FrequencyProperty(this));
    this.properties.set('info', new InfoProperty(this));
    this.properties.set('cover', new CoverProperty(this));

    this.actionPrevious = {
      title: this.adapter.config.emojis ? '⏮' : 'Previous',
      description: 'Skip to the previous track',
    };
    this.actionNext = {
      title: this.adapter.config.emojis ? '⏭' : 'Next',
      description: 'Skip to the next track',
    };

    this.addAction('previous', this.actionPrevious);
    this.actionsfn.previous = this.fsapi.action_previous.bind(this.fsapi);
    this.addAction('next', this.actionNext);
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

  updateAllProperties() {
    console.log(this.id, 'Updating all properties!');
    for (const entry of this.properties.entries()) {
      if (this.properties.get(entry[0]).update) this.properties.get(entry[0]).update();
    }
  }

  detectUpdates() {
    this.fsapi.getnotifies(((list) => {
      if ('dead' in this) return;
      console.log(this.id, 'List of changes', list);
      for (const prop in list) {
        switch (prop) {
          case 'netremote.play.info.name': case 'netremote.play.info.text': {
            this.properties.get('info').update();
            break;
          }
          default:
            if (this.properties.has(prop))
              this.properties.get(prop).updateValue(list[prop]);
            break;
        }
      }
      this.detectUpdates();
    }).bind(this));
  }

  setVisibility(list) {
    for (const [key, prop] of this.properties) {
      if (list.includes(key))
        prop.visible = true;
      else
        prop.visible = false;
    }
    if (list.includes('previous')) {
      if (!(this.actions.has('previous')))
        this.addAction('previous', this.actionPrevious);
    } else {
      this.actions.delete('previous');
    }
    if (list.includes('next')) {
      if (!(this.actions.has('next')))
        this.addAction('next', this.actionNext);
    } else {
      this.actions.delete('next');
    }
  }

  run() {
    if ('dead' in this) return;
    if (!this.connected) {
      this.fsapi.connect(((stat) => {
        this.connectedNotify(stat);
        if (stat) {
          this.updateAllProperties();
          this.detectUpdates();
        } else {
          setTimeout((() => {
            this.run();
          }).bind(this), this.adapter.config.reconnectInterval*1000);
        }
      }).bind(this));
    }
  }

  stop() {
    console.log(this.id, 'Stop!');
    this.dead = true;
  }

  connectedNotify(stat) {
    super.connectedNotify(stat);
    if (!('connected' in this)) {
      this.connected = stat;
      return;
    }
    if (this.connected !== stat) {
      if (stat) {
        console.log(this.id, 'Connected!');
      } else {
        console.log(this.id, 'Disconnected!');
      }
      this.connected = stat;
    }
  }
}

module.exports = RadioDevice;
