'use strict';

var Limit = require('./limit');

module.exports = Limits;

function Limits (obj) {
  this._bank = new Limit(obj.bank);
}

Object.defineProperties(Limits.prototype, {
  'bank': {
    configurable: false,
    get: function () {
      return this._bank;
    }
  }
});
