"use strict";

var mongoose = require('mongoose'),
  Payment = require('./payment'),
  Transaction = require('./transaction'),
  ErrorModel = require('./error');

/**
 *
 * @param {Object} config
 * @returns {Promise}
 */
module.exports = function(config) {

  var conn = mongoose.createConnection(
    config.db.mongo.uri,
    config.db.mongo.options
  );

  var p = new Promise(function(res, rej) {
    conn.once('open', () => {
      /** @type {PaymentModel} */
      module.exports.Payment = new Payment(conn);
      /** @type {TransactionModel} */
      module.exports.Transaction = new Transaction(conn);
      /** @type {ErrorModel|exports|module.exports} */
      module.exports.Error = new ErrorModel(conn);

      module.exports.Connection = conn;
      res();
    });

    conn.once('error', rej);
  });

  return p;
};