"use strict";

var mongoose = require('mongoose'),
  Payment = require('./payment'),
  Transaction = require('./transaction'),
  ErrorModel = require('./error');

module.exports = function(config) {
  var resource = mongoose.createConnection(
    config.db.mongo.uri,
    config.db.mongo.options
  );

  // init
  Payment(resource);
  Transaction(resource);
  ErrorModel(resource);

  exports.Resource = resource;
};

exports.Payment = Payment;
exports.Transaction = Transaction;
exports.Error = ErrorModel;