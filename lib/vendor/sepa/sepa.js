"use strict";

var PaymentAbstract = require('../payment'),
  Paymnd = require('../..'),
  Error = require('../../error'),
  Promise = require('bluebird'),
  Status = require('../../status'),
  debug = require('debug')('paymnd:vendor:sepa');

/**
 * @param {object} options
 * @constructor
 */
class SepaPayment extends PaymentAbstract {

  constructor(options)
  {
    super(options);

    this.middleware = {};

    /**
     * @type {action: {state: state}}
     */
    this.state = {
      refund: Status.REFUND,
      create: Status.CREATE,
      debit: Status.DEBIT,
      cancel: Status.CANCEL
    };
  }


  /**
   * @param {PaymentSchema} payment
   *
   * @returns {Promise}
   */
  create(payment) {
    return Paymnd.Model.Transaction.create({
        _payment: payment._id
      })
      .catch(function(err) {
        throw new Error.PaymentError('Create SEPA payment failed', null, {error: err, paymentId: payment._id});
      });
  }

  /**
   * @param {PaymentSchema} payment
   *
   * @returns {Promise}
   */
  execute(payment) {
    debug('SepaPayment.execute#data: %o', payment);

    return Promise.resolve()
      .then(function() {
        debug('SepaPayment.execute#createTransaction:');

        return Paymnd.Model.Transaction.execute({
          _payment: payment._id,
          state: Status.DEBIT
        });
      });
  }

  /**
   * @param {PaymentSchema} payment
   *
   * @returns {Promise}
   */
  cancel(payment) {
    debug('SepaPayment.cancel#payment: %o', payment);

    return Promise.resolve()
      .then(function() {
        debug('SepaPayment.cancel#creteTransaction:');

        return Paymnd.Model.Transaction.cancel({
          _payment: payment._id,
          state: Status.CANCEL
        });
      });
  }

  /**
   * @param {PaymentSchema} payment
   *
   * @returns {Promise}
   */
  refund(payment) {
    debug('SepaPayment.refund#data: %o', payment);

    return Promise.resolve()
      .then(function() {
        debug('SepaPayment.cancel#creteTransaction:');

        return Paymnd.Model.Transaction.refund({
          _payment: payment._id,
          state: Status.REFUND
        });
      });
  }
}

module.exports = SepaPayment;