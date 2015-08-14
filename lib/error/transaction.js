"use strict";

var AbstractError = require('./abstract'),
  util = require('util');

var TransactionError = function (message, code, params) {
  TransactionError.super_.call(this, message, code, params, this.constructor);
};

util.inherits(TransactionError, AbstractError);
TransactionError.prototype.name = 'TransactionError';

module.exports = TransactionError;