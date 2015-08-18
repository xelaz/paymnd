/**
 * Inherit from `Error`.
 */

var AbstractError = require('./abstract'),
  util = require('util');

var ModelError = function (message, code, params) {
  ModelError.super_.call(this, message, code, params, this.constructor);
  this.name    = this.constructor.name;
};

util.inherits(ModelError, AbstractError);

module.exports = ModelError;