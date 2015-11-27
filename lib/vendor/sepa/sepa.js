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

  return Paymnd.Model.Transaction.create({
      _payment: payment._id
    })
    .save()
    .catch(function(err) {
      throw new Paymnd.Error.Payment('Create SEPA payment failed', null, {error: err, paymentId: payment._id});
    });
};

/**
 * @param {PaymentSchema} payment
 *
 * @returns {Promise}
 */
SepaPayment.prototype.execute = function(payment) {
  debug('SepaPayment.execute#data: %o', payment);

  return Promise.resolve()
    .then(function() {
      debug('SepaPayment.execute#createTransaction:');

      return Paymnd.Model.Transaction.execute({
          _payment: payment._id,
          state: Status.DEBIT
        })
        .save();
    });
};

/**
 * @param {PaymentSchema} payment
 *
 * @returns {Promise}
 */
SepaPayment.prototype.cancel = function(payment) {
  debug('SepaPayment.cancel#payment: %o', payment);

  return Promise.resolve()
    .then(function() {
      debug('SepaPayment.cancel#creteTransaction:');

      return Paymnd.Model.Transaction.cancel({
          _payment: payment._id,
          state: Status.CANCEL
        })
        .save();
    });
};

/**
 * @param {PaymentSchema} payment
 *
 * @returns {Promise}
 */
SepaPayment.prototype.refund = function(payment) {
  debug('SepaPayment.refund#data: %o', payment);

  return Promise.resolve()
    .then(function() {
      debug('SepaPayment.cancel#creteTransaction:');

      return Paymnd.Model.Transaction.refund({
          _payment: payment._id,
          state: Status.REFUND
        })
        .save();
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