"use strict";

// Grab the util module that's bundled with Node
var util = require('util');

class AbstractError extends Error {
  constructor(message, code, params) {
    super(message);
    this.name = this.constructor.name;
    this.message = message;
    this.code = code;
    this.params = params;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AbstractError;
/*var AbstractError = function(message, code, params, constr) {

  this.message = message || 'Paymnd Error';
  this.code = code;
  this.params = params;

  Error.captureStackTrace(this, constr || this);
};
util.inherits(AbstractError, Error);

AbstractError.prototype.name = 'AbstractError';

module.exports = AbstractError;*/