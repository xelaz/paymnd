/**
 * Inherit from `Error`.
 */

var AbstractError = require('./abstract'),
  util = require('util');

var PaymentError = function (message, code, params) {
  PaymentError.super_.call(this, message, code, params, this.constructor);
  this.name    = this.constructor.name;
};

util.inherits(PaymentError, AbstractError);

module.exports = PaymentError;