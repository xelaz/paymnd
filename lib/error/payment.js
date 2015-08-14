/**
 * Inherit from `Error`.
 */

var AbstractError = require('./abstract'),
  util = require('util');

var PaymentError = function (message, code, params) {
  PaymentError.super_.call(this, message, code, params, this.constructor);
};

util.inherits(PaymentError, AbstractError);
PaymentError.prototype.name = 'PaymentError'

module.exports = PaymentError;