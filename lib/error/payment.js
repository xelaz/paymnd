/**
 * Inherit from `Error`.
 */

var AbstractError = require('./abstract'),
  util = require('util');

function PaymentError(message, code, params) {
  this.name    = this.constructor.name;

  PaymentError.super_.call(this, message, code, params, this.constructor);
}
util.inherits(PaymentError, AbstractError);

module.exports = PaymentError;