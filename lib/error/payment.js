"use strict";

var AbstractError = require('./abstract');

class PaymentError extends AbstractError {

  constructor(message, code, params) {
    super(message, code, params);
    this.name = this.constructor.name;
  }
}

module.exports = PaymentError;