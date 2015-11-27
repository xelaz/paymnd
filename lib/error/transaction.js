"use strict";

var AbstractError = require('./abstract'),
  util = require('util');

function TransactionError(message, code, params) {
  this.name = this.constructor.name;

  TransactionError.super_.call(this, message, code, params, this.constructor);
}
util.inherits(TransactionError, AbstractError);

module.exports = TransactionError;