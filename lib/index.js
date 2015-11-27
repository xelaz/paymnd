"use strict";


var Paymnd = function(config) {

  var util = require('util'),
    Status = require('./status'),
    Error = require('./error'),
    Model = require('./model'),
    Vendor = require('./vendor'),
    Middleware = require('./middleware');

  Model(config);
  Paymnd.Config = config;
  Paymnd.Vendor = Vendor(config);
  Paymnd.Middleware = Middleware(config);
  Paymnd.Status = Status;
  Paymnd.Error = Error;
  Paymnd.Model = Model;

  return Paymnd;
};

module.exports = Paymnd;