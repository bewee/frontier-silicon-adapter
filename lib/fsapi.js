'use strict';

const {URLSearchParams} = require('url');
const fetch = require('node-fetch');
const parseXML = require('xml2js').Parser().parseString;

class FSAPI {

  constructor(ip, pin, disconnectcb = null) {
    this.ip = ip;
    this.pin = pin;
    this.disconnectcb = disconnectcb;
  }

  doRequest(path, options, cb) {
    const params = new URLSearchParams(options).toString();
    const url = `http://${this.ip}/fsapi/${path}/?${params}`;
    console.log(url);
    fetch(url).then(((res) => {
      if (!res) {
        cb(null);
        return;
      }
      res.text().then(((text) => {
        if (!text) {
          cb(null);
          return;
        }
        parseXML(text, ((e, r) => {
          if (e) {
            cb(null);
            return;
          }
          cb(r);
        }).bind(this));
      }).bind(this));
    }).bind(this));
  }

  connect(cb = null) {
    this.doRequest('CREATE_SESSION', {pin: this.pin}, ((data) => {
      if (data && data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0] == 'FS_OK' && data.fsapiResponse.sessionId && data.fsapiResponse.sessionId[0]) {
        this.sid = data.fsapiResponse.sessionId[0];
        if (cb) cb(true);
      } else {
        if (cb) cb(false);
      }
    }).bind(this));
  }

  get(prop, cb = null, ecb = null) {
    this.doRequest(`GET/${prop}`, {pin: this.pin}, ((data) => {
      if (!(data && data.fsapiResponse && data.fsapiResponse.status)) {
        if (this.disconnectcb) this.disconnectcb();
        return;
      }
      if (data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0] == 'FS_OK' && data.fsapiResponse.value && data.fsapiResponse.value[0]) {
        const valnode = data.fsapiResponse.value[0];
        const val = valnode[Object.keys(valnode)[0]][0];
        if (cb) cb(val);
      } else {
        console.error(this.ip, 'This should not happen.', 'GET', prop);
        if (ecb) ecb();
      }
    }).bind(this));
  }

  set(prop, val, cb = null, ecb = null) {
    this.doRequest(`SET/${prop}`, {pin: this.pin, value: val}, ((data) => {
      if (!(data && data.fsapiResponse && data.fsapiResponse.status)) {
        if (this.disconnectcb) this.disconnectcb();
        return;
      }
      if (data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0] == 'FS_OK') {
        if (cb) cb();
      } else {
        console.error(this.ip, 'This should not happen.', 'SET', prop, val);
        if (ecb) ecb();
      }
    }).bind(this));
  }

  getlist(prop, cb, ecb = null, index = -1) {
    this.doRequest(`LIST_GET_NEXT/${prop}/${index}`, {pin: this.pin, maxItems: 100}, ((data) => {
      if (!(data && data.fsapiResponse && data.fsapiResponse.status)) {
        if (this.disconnectcb) this.disconnectcb();
        return;
      }
      if (data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0] == 'FS_OK' && data.fsapiResponse.item && data.fsapiResponse.item[0]) {
        const list = [];
        for (const it of data.fsapiResponse.item) {
          list.push(it);
        }
        if (cb) cb(list);
      } else if (data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0] == 'FS_LIST_END') {
        if (cb) cb([]);
      } else {
        console.error(this.ip, 'This should not happen.', 'LIST_GET_NEXT');
        if (ecb) ecb();
      }
    }).bind(this));
  }

  // requires a valid sid
  getnotifies(cb) {
    this.doRequest('GET_NOTIFIES', {pin: this.pin, sid: this.sid}, ((data) => {
      //console.log('ndata', data);
      if (!(data && data.fsapiResponse && data.fsapiResponse.status)) {
        if (this.disconnectcb) this.disconnectcb();
        return;
      }
      if (data.fsapiResponse.status[0] == 'FS_TIMEOUT') {
        this.getnotifies(cb);
      } else if (data.fsapiResponse.status[0] == 'FS_OK') {
        const list = {};
        for (const node of data.fsapiResponse.notify) {
          const valnode = node.value[0];
          const prop = node.$.node;
          const val = valnode[Object.keys(valnode)[0]][0];
          list[prop] = val;
        }
        cb(list);
      } else {
        console.error(this.ip, 'This should not happen.', 'GET_NOTIFIES');
      }
    }).bind(this));
  }

  getlist_sysmodes(cb) {
    this.getlist('netremote.sys.caps.validModes', ((list) => {
      let n = 0;
      cb(list.map((x) => ({
        n: n++,
        id: x.field[0].c8_array[0],
        selectable: parseInt(x.field[1].u8[0])?true:false,
        label: x.field[2].c8_array[0],
        streamable: parseInt(x.field[3].u8[0])?true:false,
      })));
    }).bind(this));
  }

  action_stop(cb = null) {
    this.set('netremote.play.control', 0, (() => {
      if (cb) cb();
    }).bind(this));
  }

  action_play(cb = null) {
    this.set('netremote.play.control', 1, (() => {
      if (cb) cb();
    }).bind(this));
  }

  action_pause(cb = null) {
    this.set('netremote.play.control', 2, (() => {
      if (cb) cb();
    }).bind(this));
  }

  action_next(cb = null) {
    this.set('netremote.play.control', 3, (() => {
      if (cb) cb();
    }).bind(this));
  }

  action_previous(cb = null) {
    this.set('netremote.play.control', 4, (() => {
      if (cb) cb();
    }).bind(this));
  }

}

module.exports = FSAPI;
