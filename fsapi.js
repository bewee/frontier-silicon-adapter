/**
 * fsapi.js - FrontierSilicon adapter.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

const {URLSearchParams} = require('url')
const fetch = require('node-fetch')
const parseXML = require('xml2js').Parser().parseString

class FSAPI {

    constructor(ip, pin, cb, connfailcb = null){
        this.ip = ip;
        this.pin = pin;
        this.connfailcb = connfailcb;
        this.connect(cb);
    }

    doRequest(path, options, cb){
        let params = new URLSearchParams(options).toString();
        const url = "http://"+this.ip+"/fsapi/"+path+"/?"+params;
        fetch(url)
        .then( res => {
            if(!res){    
                cb(null);
                return;
            }
            res.text().then(text => {
                if(!text){    
                    cb(null);
                    return;
                }
                parseXML(text, (e,r) => {
                    if(e){
                        cb(null);
                        return;
                    }
                    cb(r);
                });
            })
            
        })
    }

    connect(cb = null){
        let _self = this;
        this.doRequest("CREATE_SESSION", {pin: _self.pin}, function(data){
            if(data && data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0]=='FS_OK' && data.fsapiResponse.sessionId && data.fsapiResponse.sessionId[0]){
                _self.sid = data.fsapiResponse.sessionId[0];
                if(cb) cb(true);
            } else {
                if(cb) cb(false);
                if(_self.connfailcb) _self.connfailcb();
            }
        });
    }

    get(prop, cb = null, ecb = null, recurse=true){
        let _self = this;
        this.doRequest("GET/"+prop, {pin: _self.pin, sid: _self.sid}, function(data){
            if(!data){
                if(recurse)
                    _self.connect(function(stat){
                        if(stat){
                            console.error("Reconnected. Trying GET one more time!");
                            _self.get(prop,cb,ecb,false);
                        }
                        else 
                            if(ecb) ecb("Reconnect failed!");
                    });
                return;
            }
            if(data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0]=='FS_OK' && data.fsapiResponse.value && data.fsapiResponse.value[0])
                if(cb) cb(data.fsapiResponse.value[0]);
            else
                if(ecb) ecb("GET failed!");
        });
    }

    set(prop, val, cb = null, ecb = null, recurse=true){
        let _self = this;
        this.doRequest("SET/"+prop, {pin: _self.pin, sid: _self.sid, value: val}, function(data){
            if(!data && recurse){
                _self.connect(function(stat){
                    if(stat){
                        console.error("Reconnected. Trying SET one more time!");
                        _self.set(prop,cb,false);
                    }
                    else 
                        if(ecb) ecb("Reconnect failed!");
                });
                return;
            }
            if(data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0]=='FS_OK')
                if(cb) cb();
            else
                if(ecb) ecb("SET failed!");
        });
    }

    getitem(prop, index, cb, ecb, recurse=true){
        let _self = this;
        this.doRequest("LIST_GET_NEXT/"+prop+"/"+(index-1), {pin: _self.pin, sid: _self.sid}, function(data){
            if(!data){
                if(recurse)
                    _self.connect(function(stat){
                        if(stat){
                            console.error("Reconnected. Trying LIST_GET_NEXT one more time!");
                            _self.getitem(prop,index,cb,ecb,false);
                        }
                        else 
                            if(ecb) ecb("Reconnect failed!");
                    });
                return;
            }
            if(data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0]=='FS_OK' && data.fsapiResponse.item && data.fsapiResponse.item[0]){
                if(cb) cb(data.fsapiResponse.item[0]);
            }else if(data.fsapiResponse && data.fsapiResponse.status && data.fsapiResponse.status[0]=='FS_LIST_END'){
                if(cb) cb(false);
            }else{
                if(ecb) ecb("LIST_GET_NEXT failed!");
            }
        });
    }

    getlist(prop, cb, ecb = null, index = 0, list = []){
        let _self = this;
        this.getitem(prop, index, function(item){
            //console.log("item", JSON.stringify(item));
            if(!item){
                if(cb) cb(list);
            } else {
                list.push(item);
                _self.getlist(prop, cb, ecb, index+1, list);
            }
        }, ecb);
    }

    get_power(cb){
        this.get("netRemote.sys.power", function(data){
            cb(parseInt(data.u8[0]));
        });
    }
    set_power(val, cb = null){
        this.set("netRemote.sys.power", val?1:0, function(){
            if(cb) cb();
        });
    }

    get_volume(cb){
        this.get("netRemote.sys.audio.volume", function(data){
            cb(parseInt(data.u8[0]));
        });
    }
    set_volume(val, cb = null){
        this.set("netRemote.sys.audio.volume", val, function(){
            if(cb) cb();
        });
    }

    get_playing(cb){
        this.get("netRemote.play.control", function(data){
            if(cb) cb((parseInt(data.u8[0])==0 || parseInt(data.u8[0])==2) ? 0 : 1);
        })
    }
    set_playing(val, cb = null){
        if(val) this.action_play(cb);
        else    this.action_pause(cb);
    }
    action_stop(cb = null){
        this.set("netRemote.play.control", 0, function(){
            if(cb) cb();
        });
    }
    action_play(cb = null){
        this.set("netRemote.play.control", 1, function(){
            if(cb) cb();
        });
    }
    action_pause(cb = null){
        this.set("netRemote.play.control", 2, function(){
            if(cb) cb();
        });
    }
    action_next(cb = null){
        this.set("netRemote.play.control", 3, function(){
            if(cb) cb();
        });
    }
    action_previous(cb = null){
        this.set("netRemote.play.control", 4, function(){
            if(cb) cb();
        });
    }
    
    get_muted(cb){
        this.get("netRemote.sys.audio.mute", function(data){
            cb(parseInt(data.u8[0]));
        })
    }
    set_muted(val, cb = null){
        this.set("netRemote.sys.audio.mute", val?1:0, function(){
            if(cb) cb();
        });
    }

    getlist_sysmodes(cb){
        this.getlist("netRemote.sys.caps.validModes", function(list){
            cb(list.map(x => x.field[2].c8_array[0]));
        });
    }
    get_sysmode(cb){
        this.get("netRemote.sys.mode", function(data){
            cb(parseInt(data.u32[0]));
        })
    }
    set_sysmode(val, cb = null){
        this.set("netRemote.sys.mode", val, function(){
            if(cb) cb();
        });
    }

};

module.exports = FSAPI;