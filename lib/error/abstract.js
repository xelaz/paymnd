"use strict";

// Grab the util module that's bundled with Node
var util = require('util'),
  model = require('../model/index');

var AbstractError = function (message, code, params, constr) {
  Error.captureStackTrace(this, constr || this);
  this.message = message || 'Paymnd Error';
  this.code = code;
  this.params = params;

  model.Error.Model.log(this);
};
util.inherits(AbstractError, Error);
AbstractError.prototype.name = 'AbstractError';

module.exports = AbstractError;