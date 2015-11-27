/**
 * Inherit from `Error`.
 */

var AbstractError = require('./abstract'),
  util = require('util');

function ModelError(message, code, params) {
  this.name    = this.constructor.name;

  ModelError.super_.call(this, message, code, params, this.constructor);
};

util.inherits(ModelError, AbstractError);

module.exports = ModelError;