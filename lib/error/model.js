/**
 * Inherit from `Error`.
 */

var AbstractError = require('./abstract'),
  util = require('util');

var ModelError = function (message, code, params) {
  ModelError.super_.call(this, message, code, params, this.constructor);
};

util.inherits(ModelError, AbstractError);
ModelError.prototype.name = 'ModelError'

module.exports = ModelError;