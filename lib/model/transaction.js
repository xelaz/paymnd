"use strict";

var Schema = require('mongoose').Schema,
  Status = require('../status'),
  uuid = require('node-uuid'),
  PayMe = require('../index');

var TransactionSchema = new Schema({

  action: {
    type: String,
    enum: ['create', 'execute', 'get', 'refund', 'cancel', 'ping'],
    index: true
  },

  session: {},

  // is the parent
  _payment: {
    type: Schema.Types.ObjectId,
    ref: 'Payment'
  },

  // this is extern TXN Id from Vendor
  txn: {
    type: String,
    index: true
  },

  // this is our own Intern TXN
  iTxn: {
    type: String,
    index: true
  },

  // write full response content from vendor callback
  request: Schema.Types.Mixed,

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
      return new PayMe.Error.Model('Error on update status', null, {error: err, paymentId: doc._payment});
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
        callback(new PayMe.Error.Model(err));
      } else if(transaction) {
        callback(null, transaction);
      } else {
        callback(new PayMe.Error.Model('Transaction with iTxn "' + iTxn + '" was not found'));
      }
    });
});

/**
 * @param {String}  Payment ObjectId
 * @return {String} Vendor TXN
 */
TransactionSchema.static('getTxnByOrderId', function (orderId, callback) {
  this.find({action: 'create'}, {txn: 1, _id: 0})
    .populate({
      path: '_payment',
      match: { order: orderId}
    })
    .exec(function (err, txns) {
      if (err) {
        callback(new PayMe.Error.Model(err));
      } else if(txns.length) {
        callback(null, txns[0].txn);
      } else {
        callback(new PayMe.Error.Model('Transaction with PaymentId "' + iTxn + '" was not found'));
      }
    });
});

/**
 * @param {Object}   paymentId
 * @param {Function} callback
 */
TransactionSchema.static('getTxnByPaymentId', function (paymentId, callback) {
  this.find({'_payment': paymentId, action: Status.CREATE}, {txn: 1, _id: 0})
    .exec(function (err, txns) {
      if (err) {
        callback(new PayMe.Error.Model(err));
      } else if(txns.length) {
        callback(null, txns[0].txn);
      } else {
        callback(new PayMe.Error.Model('Transaction with PaymentId "' + iTxn + '" was not found'));
      }
    });
});

TransactionSchema.static('add', function (data, callback) {

});

/**
 * Extend TransAction with Paypal specific Method
 */
TransactionSchema.static('getPaypalSaleId', function (paymentId, callback) {
  this.findOne({_payment: paymentId, 'request.state': 'approved'})
    .populate('_payment')
    .exec(function (err, payment) {
      if (err) {
        callback(new PayMe.Error.Model(err));
      } else if(payment) {
        var saleId = null;
        try {
          saleId = payment.request.transactions[0].related_resources[0].sale.id
        } catch(e) {
          return callback(new PayMe.Error.Model('SaleId on PaymentId "' + paymentId + '" not found'));
        }
        callback(null, saleId);
      } else {
        callback(new PayMe.Error.Model('Transaction with PaymentId "' + paymentId + '" was not found'));
      }
    });
});

/**
 * Extend TransAction with Paypal specific Method
 */
TransactionSchema.static('getMicropaymentTransaction', function (paymentId, callback) {
  this.findOne({_payment: paymentId, 'request.transactionStatus': 'SUCCESS'})
    .populate('_payment')
    .exec(function (err, transaction) {
      if (err) {
        callback(new PayMe.Error.Model(err));
      } else if(transaction) {
        callback(null, transaction);
      } else {
        callback(new PayMe.Error.Model('Transaction with PaymentId "' + paymentId + '" was not found'));
      }
    });
});

module.exports = function(mongoose) {
  exports.Model = mongoose.model('Transaction', TransactionSchema);
};

exports.Schema = TransactionSchema;