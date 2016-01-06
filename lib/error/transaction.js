"use strict";

var AbstractError = require('./abstract');


class TransactionError extends AbstractError {

  constructor(message, code, params) {
    super(message, code, params);
    this.name = this.constructor.name;
  }
}

module.exports = TransactionError;