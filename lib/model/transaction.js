"use strict";

var Schema = require('mongoose').Schema,
  Status = require('../status'),
  uuid = require('node-uuid'),
  Paymnd = require('../index'),
  Promise = require('bluebird'),
  _extend = require('util')._extend;

var TransactionSchema = new Schema({

  action: {
    type: String,
    enum: ['create', 'execute', 'get', 'refund', 'cancel', 'ping'],
    index: true,
    required: true
  },

  session: {},

  // is the parent and the TXN
  _payment: {
    type: Schema.Types.ObjectId,
    ref: 'Payment',
    index: true,
    required: true
  },

  // this is extern TXN Id from Vendor
  eTxn: {
    type: String,
    index: true
  },

  // write full response content from vendor callback
  response: Schema.Types.Mixed,

  // vendor status
  state: String,

  createdAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * @return {String}
 */
TransactionSchema.static('generateTxn', function () {
  return uuid.v4();
});

/**
 * Update the Status after insert the Transaction
 */
TransactionSchema.post('save', function (doc) {
  this.model('Payment').updateStatus(doc, function(err) {
    if(err) {
      return new Paymnd.Error.Model('Error on update status', null, {error: err, paymentId: doc._payment});
    }
  });
});

/**
 * @param {String}   iTxn
 * @param {Function} callback
 */
TransactionSchema.static('getByInternTxnId', function (iTxn, callback) {
  this.findOne({'iTxn': iTxn})
    .populate('_payment')
    .exec(function (err, transaction) {
      if (err) {
        callback(new Paymnd.Error.Model(err));
      } else if(transaction) {
        callback(null, transaction);
      } else {
        callback(new Paymnd.Error.Model('Transaction with iTxn "' + iTxn + '" was not found'));
      }
    });
});

/**
 * @param {String}   orderId
 * @param {Function} callback
 */
TransactionSchema.static('getFirstTransactionByOrderId', function (orderId, callback) {
  this.findOne({action: 'create'})
    .populate({
      path: '_payment',
      match: { order: orderId}
    })
    .populate('_payment')
    .exec(function (err, transaction) {
      if (err) {
        callback(new Paymnd.Error.Model(err));
      } else if(transaction) {
        callback(null, transaction);
      } else {
        callback(new Paymnd.Error.Model('Transaction with OrderId "' + orderId + '" was not found'));
      }
    });
});

/**
 * @param {String}  Payment ObjectId
 * @return {String} Vendor TXN
 */
TransactionSchema.static('getTxnByOrderId', function (orderId, callback) {
  this.findOne({action: 'create'}, {txn: 1, _id: 0})
    .populate({
      path: '_payment',
      match: { order: orderId}
    })
    .populate('_payment')
    .exec(function (err, txn) {
      if (err) {
        callback(new Paymnd.Error.Model(err));
      } else if(txn) {
        callback(null, txn);
      } else {
        callback(new Paymnd.Error.Model('Transaction with OrderId "' + orderId + '" was not found'));
      }
    });
});

/**
 * @param {Object}   paymentId
 * @param {Function} callback
 */
TransactionSchema.static('getTxnByPaymentId', function (paymentId, callback) {
  this.findOne({'_payment': paymentId, action: Status.CREATE}, {txn: 1, _id: 0})
    .exec(function (err, txn) {
      if (err) {
        callback(new Paymnd.Error.Model(err));
      } else if(txn) {
        callback(null, txn);
      } else {
        callback(new Paymnd.Error.Model('Transaction with PaymentId "' + paymentId + '" was not found'));
      }
    });
});

/**
 * Extend TransAction with Paypal specific Method
 */
TransactionSchema.static('getPaypalSaleId', function (paymentId, callback) {
  this.findOne({_payment: paymentId, 'response.state': 'approved'})
    .populate('_payment')
    .exec(function (err, payment) {
      if (err) {
        callback(new Paymnd.Error.Model(err));
      } else if(payment) {
        var saleId = null;
        try {
          saleId = payment.response.transactions[0].related_resources[0].sale.id
        } catch(e) {
          return callback(new Paymnd.Error.Model('SaleId on PaymentId "' + paymentId + '" not found'));
        }
        callback(null, {saleId: saleId, iTxn: payment.iTxn});
      } else {
        callback(new Paymnd.Error.Model('Transaction with PaymentId "' + paymentId + '" was not found'));
      }
    });
});

function Transaction(transaction) {
  this._transaction = new module.exports.Model(transaction);
}

/**
 *
 * @returns {Promise<T>}
 */
Transaction.prototype.save = function() {
  var _transaction = this._transaction;

  return new Promise(function(res, rej) {
    _transaction.save(function(err) {
      if(err) {
        rej(new Paymnd.Error.Model('Transaction save is failed', null, {error:err, paymentId:_transaction._payment}));
      } else {
        res(true);
      }
    });
  });
};

module.exports = function(connection) {
  module.exports.Model = connection.model('Transaction', TransactionSchema);
};

module.exports.Schema = TransactionSchema;

module.exports.Transaction = Transaction;

/**
 * @returns {Transaction}
 */
module.exports.create = function(data) {
  return new Transaction(_extend({
    action: 'create',
    state: 'create'
  }, data));
};

/**
 * @returns {Transaction}
 */
module.exports.execute = function(data) {
  return new Transaction(_extend({
    action: 'execute',
    state: Status.PENDING
  }, data));
};

/**
 * @returns {Transaction}
 */
module.exports.cancel = function(data) {
  return new Transaction(_extend({
    action: 'cancel',
    state: Status.CANCEL
  }, data));
};

/**
 * @returns {Transaction}
 */
module.exports.refund = function(data) {
  return new Transaction(_extend({
    action: 'refund',
    state: Status.REFUND
  }, data));
};
