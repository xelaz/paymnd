"use strict";

var paypal = require('paypal-rest-sdk'),
  util = require('util'),
  Payment = require('../payment'),
  Paymnd = require('../..'),
  Promise = require('bluebird'),
  Status = require('../../status'),
  debug = require('debug')('paymnd:vendor:sepa');

/**
 * @param {object} options
 * @constructor
 */
var SepaPayment = function SepaPayment(options) {
  this.options = util._extend({title:'SEPA'}, options);
  Payment.call(this, this.options);
};
util.inherits(SepaPayment, Payment);

// CreditCard do not need middleware
SepaPayment.prototype.middleware = {};

/**
 * @param {object} payment
 *
 * @returns {Promise}
 */
SepaPayment.prototype.create = function(payment) {
  // generate internTxn for identify the payment with vendor
  var internTxn = Paymnd.Model.Transaction.Model.generateTxn();

  // TODO: check the parameter of right schema to avoid errors
  var transaction = new Paymnd.Model.Transaction.Model({
    iTxn: internTxn,
    _payment: payment._id,
    action: 'create',
    state: 'create'
  });

  var promise = new Promise(function(res, rej) {
    transaction.save(function(err) {
      if(err) {
        rej(new Paymnd.Error.Model('Transaction save is failed', null, {error:err, paymentId:payment._id}));
      } else {
        res(true);
      }
    });
  });

  return promise
    .catch(function(err) {
      throw new Paymnd.Error.Transaction('Create payment failed', null, {error: err, paymentId: payment._id});
    });
};

/**
 * @param {PaymentSchema} payment
 *
 * @returns {Promise}
 */
SepaPayment.prototype.execute = function(payment) {
  debug('SepaPayment.prototype.execute#data:', payment);

  return Promise.resolve()
    .then(function() {
      return new Promise(function(res, rej) {
        Paymnd.Model.Transaction.Model.getFirstTransactionByOrderId(payment.orderId, function(err, transactionPayment) {
          debug('SepaPayment.prototype.execute#transactionPayment:', transactionPayment);

          if(err) {
            rej(new Paymnd.Error.Model('Payment execute failed', null, {error: err, iTxn: data.iTxn}));
          } else {
            res(transactionPayment);
          }
        });
      });
    })
    .then(function(transactionPayment) {
      debug('SepaPayment.payment.execute#createTransaction:');

      var paymentId = payment._id;

      var transaction = new Paymnd.Model.Transaction.Model({
        iTxn: transactionPayment.iTxn,
        _payment: paymentId,
        action: 'execute',
        state: 'debit'
      });

      return new Promise(function(res, rej) {
        transaction.save(function(err) {
          if (err) return rej(new Paymnd.Error.Model('Transaction save is failed', null, {error:err, paymentId: paymentId}));
          // alles OKay
          res(true);
        });
      });
    });
};

/**
 * @param {PaymentSchema} payment
 *
 * @returns {Promise}
 */
SepaPayment.prototype.cancel = function(payment) {
  debug('SepaPayment.prototype.cancel#data:', payment);

  return Promise.resolve()
    .then(function() {
      return new Promise(function(res, rej) {
        Paymnd.Model.Transaction.Model.getFirstTransactionByOrderId(payment.orderId, function(err, transactionPayment) {
          debug('SepaPayment.prototype.cancel#transactionPayment:', transactionPayment);

          if(err) {
            rej(new Paymnd.Error.Model('Payment execute failed', null, {error: err, iTxn: data.iTxn}));
          } else {
            res(transactionPayment);
          }
        });
      });
    })
    .then(function(transactionPayment) {
      debug('SepaPayment.payment.cancel#creteTransaction:');

      var paymentId = transactionPayment._payment._id;

      var transaction = new Paymnd.Model.Transaction.Model({
        iTxn: transactionPayment.iTxn,
        _payment: paymentId,
        action: 'cancel',
        state: 'cancel'
      });

      return new Promise(function(res, rej) {
        transaction.save(function(err) {
          if (err) return rej(new Paymnd.Error.Model('Transaction save is failed', null, {error:err, paymentId: paymentId}));
          // alles OKay
          res(true);
        });
      });
    });
};

/**
 * @param {PaymentSchema} payment
 *
 * @returns {Promise}
 */
SepaPayment.prototype.refund = function(payment) {
  debug('SepaPayment.prototype.refund#data:', payment);

  return Promise.resolve()
    .then(function() {
      return new Promise(function(res, rej) {
        Paymnd.Model.Transaction.Model.getFirstTransactionByOrderId(payment.orderId, function(err, transactionPayment) {
          debug('SepaPayment.prototype.refund#transactionPayment:', transactionPayment);

          if(err) {
            rej(new Paymnd.Error.Model('Payment execute failed', null, {error: err, iTxn: data.iTxn}));
          } else {
            res(transactionPayment);
          }
        });
      });
    })
    .then(function(transactionPayment) {
      debug('SepaPayment.payment.refund#createTransaction:');

      var paymentId = payment._id;
      var transaction = new Paymnd.Model.Transaction.Model({
        iTxn: transactionPayment.iTxn,
        _payment: paymentId,
        action: 'refund',
        state: 'refund'
      });

      return new Promise(function(res, rej) {
        transaction.save(function(err) {
          if (err) return rej(new Paymnd.Error.Model('Transaction save is failed', null, {error:err, paymentId: paymentId}));
          // alles OKay
          res(true);
        });
      });
    });
};

/**
 * @type {action: {state: state}}
 */
SepaPayment.prototype.state = {
  refund: Status.REFUND,
  create: Status.CREATE,
  debit: Status.DEBIT,
  cancel: Status.CANCEL
};

// CreditCard do not need middleware
SepaPayment.prototype.middleware = {};

module.exports = SepaPayment;