"use strict";

module.exports = exports = function(config) {
  var util = require('util'),
    Status = require('./status'),
    Error = require('./error'),
    Model = require('./model'),
    Vendor = require('./vendor'),
    Middleware = require('./middleware');

  Model(config);
  exports.Config = config;
  exports.Vendor = Vendor(config);
  exports.Middleware = Middleware(config);
  exports.Status = Status;
  exports.Error = Error;
  exports.Model = Model;


  return exports;
};