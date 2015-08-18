"use strict";

var AbstractError = require('./abstract'),
  util = require('util');

var TransactionError = function (message, code, params) {
  TransactionError.super_.call(this, message, code, params, this.constructor);
  this.name    = this.constructor.name;
};
util.inherits(TransactionError, AbstractError);

module.exports = TransactionError;