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

  resource.on('error', function(err) {
    console.log('Paymnd Connection', err.stack, config);
  });

  // init
  Payment(resource);
  Transaction(resource);
  ErrorModel(resource);

  module.exports.Resource = resource;
};

module.exports.Payment = Payment;
module.exports.Transaction = Transaction;
module.exports.Error = ErrorModel;