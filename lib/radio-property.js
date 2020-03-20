'use strict';

const {_Adapter, _Database, _Device, Property} = require('gateway-addon');

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

module.exports = RadioProperty;
