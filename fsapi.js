'use strict';

const {URLSearchParams} = require('url');
const fetch = require('node-fetch');
const parseXML = require('xml2js').Parser().parseString;

class FSAPI {

  constructor(ip, pin, cb, disconnectcb = null) {
    this.ip = ip;
    this.pin = pin;
    this.disconnectcb = disconnectcb;
    this.connect(cb);
  }

  doRequest(path, options, cb) {
    const params = new URLSearchParams(options).toString();
    const url = `http://${this.ip}/fsapi/${path}/?${params}`;
    //console.log(url);
    fetch(url).then((res) => {
      if (!res) {
        cb(null);
        return;
      }
      res.text().then((text) => {
        if (!text) {
          cb(null);
          return;
        }
        parseXML(text, (e, r) => {
          if (e) {
            cb(null);
            return;
          }
          cb(r);
        });
      });
    });
  }

  connect(cb = null) {
    const _self = this;
    this.doRequest('CREATE_SESSION', {pin: _self.pin}, (data) => {
      if (data && data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0] == 'FS_OK' && data.fsapiResponse.sessionId && data.fsapiResponse.sessionId[0]) {
        _self.sid = data.fsapiResponse.sessionId[0];
        if (cb) cb(true);
      } else {
        if (cb) cb(false);
      }
    });
  }

  get(prop, cb = null, ecb = null) {
    const _self = this;
    this.doRequest(`GET/${prop}`, {pin: _self.pin, sid: _self.sid}, (data) => {
      if (!(data && data.fsapiResponse && data.fsapiResponse.status)) {
        if (_self.disconnectcb) _self.disconnectcb();
        return;
      }
      if (data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0] == 'FS_OK' && data.fsapiResponse.value && data.fsapiResponse.value[0]) {
        const valnode = data.fsapiResponse.value[0];
        const val = valnode[Object.keys(valnode)[0]][0];
        if (cb) cb(val);
      } else {
        console.error('This should not happen.');
        if (ecb) ecb();
      }
    });
  }

  set(prop, val, cb = null, ecb = null) {
    const _self = this;
    this.doRequest(`SET/${prop}`, {pin: _self.pin, sid: _self.sid, value: val}, (data) => {
      if (!(data && data.fsapiResponse && data.fsapiResponse.status)) {
        if (_self.disconnectcb) _self.disconnectcb();
        return;
      }
      if (data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0] == 'FS_OK') {
        if (cb) cb();
      } else {
        console.error('This should not happen.');
        if (ecb) ecb();
      }
    });
  }

  getitem(prop, index, cb, ecb, recurse = true) {
    const _self = this;
    this.doRequest(`LIST_GET_NEXT/${prop}/${index-1}`, {pin: _self.pin, sid: _self.sid}, (data) => {
      if (!(data && data.fsapiResponse && data.fsapiResponse.status)) {
        if (_self.disconnectcb) _self.disconnectcb();
        return;
      }
      if (data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0] == 'FS_OK' && data.fsapiResponse.item && data.fsapiResponse.item[0]) {
        if (cb) cb(data.fsapiResponse.item[0]);
      } else if (data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0] == 'FS_LIST_END') {
        if (cb) cb(false);
      } else {
        console.error('This should not happen.');
        if (ecb) ecb();
      }
    });
  }

  getlist(prop, cb, ecb = null, index = 0, list = []) {
    const _self = this;
    this.getitem(prop, index, (item) => {
      //console.log("item", JSON.stringify(item));
      if (!item) {
        if (cb) cb(list);
      } else {
        list.push(item);
        _self.getlist(prop, cb, ecb, index+1, list);
      }
    }, ecb);
  }

  getnotifies(cb) {
    const _self = this;
    this.doRequest('GET_NOTIFIES', {pin: _self.pin, sid: _self.sid}, (data) => {
      //console.log('ndata', data);
      if (!(data && data.fsapiResponse && data.fsapiResponse.status)) {
        if (_self.disconnectcb) _self.disconnectcb();
        return;
      }
      if (data.fsapiResponse.status[0] == 'FS_TIMEOUT') {
        _self.getnotifies(cb);
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
        console.error('This should not happen.');
      }
    });
  }

  getlist_sysmodes(cb) {
    this.getlist('netremote.sys.caps.validModes', (list) => {
      cb(list.map((x) => x.field[2].c8_array[0]));
    });
  }

  action_stop(cb = null) {
    this.set('netremote.play.control', 0, () => {
      if (cb) cb();
    });
  }

  action_play(cb = null) {
    this.set('netremote.play.control', 1, () => {
      if (cb) cb();
    });
  }

  action_pause(cb = null) {
    this.set('netremote.play.control', 2, () => {
      if (cb) cb();
    });
  }

  action_next(cb = null) {
    this.set('netremote.play.control', 3, () => {
      if (cb) cb();
    });
  }

  action_previous(cb = null) {
    this.set('netremote.play.control', 4, () => {
      if (cb) cb();
    });
  }
  
}

module.exports = FSAPI;
