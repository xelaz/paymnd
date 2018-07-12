const mongoose = require('mongoose');

/**
 *
 * @param {Object} config
 * @returns {Promise}
 */
module.exports = function (config) {
  const {uri, options} = config.db.mongo;

  return mongoose.createConnection(uri, options)
    .then((connection) => {
      const Payment = require('./payment');
      const Transaction = require('./transaction');
      const ErrorModel = require('./error');

      /** @type {PaymentModel} */
      module.exports.Payment = new Payment(connection);
      /** @type {TransactionModel} */
      module.exports.Transaction = new Transaction(connection);
      /** @type {ErrorModel|exports|module.exports} */
      module.exports.Error = new ErrorModel(connection);

      // export connection
      module.exports.Connection = connection;
    });
};