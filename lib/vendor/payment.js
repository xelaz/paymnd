"use strict";

var Status = require('../status'),
  Promise = require('bluebird'),
  Paymnd = require('../index');

function PaymentAbstract(options) {
  // overwrite name with type if exists
  this.method = (options.method || options.name) ;

  /**
   * @type {Vendor}
   */
  this.vendor = null;
  this.init();
}

/**
 * This Function can use as initialization
 */
PaymentAbstract.prototype.init = function() {
  // empty
};

/**
 * Get Payment full method name
 *
 * @returns {String}
 */
PaymentAbstract.prototype.getName = function() {
  return this.options.name;
};

/**
 * @returns {String}
 */
PaymentAbstract.prototype.getCurrency = function() {
  return this.options.currency;
};

/**
 * Get Short Title
 *
 * @returns {String}
 */
PaymentAbstract.prototype.getTitle = function() {
  return this.options.title;
};

/**
 *  Get Short Method Type if it's extra defined
 *
 * @returns {String}
 */
PaymentAbstract.prototype.getMethod = function() {
  return this.method;
};

/**
 * @returns {Vendor}
 */
PaymentAbstract.prototype.getVendor = function() {
  return this.vendor;
};

/**
 *
 * @param {Vendor} vendor
 * @returns {*}
 */
PaymentAbstract.prototype.setVendor = function(vendor) {
  this.vendor = vendor;
  return this;
};

PaymentAbstract.prototype.getMiddleware = function() {
  return this.middleware;
};

/**
 * Get Payment Details from Vendor
 *
 * @abstract
 * @param payment
 * @param {Function, Object} options Option can be Optional
 * @param callback
 */
PaymentAbstract.prototype.get = function(payment, options, callback) {
  console.log('This Function is not implemented');
};

/**
 * Create Payment and send it to Vendor
 *
 * @abstract
 *
 * @param {PaymentSchema}    payment
 * @param {Function, Object} options Option can be Optional
 *
 * @return {Promise}
 */
PaymentAbstract.prototype.create = function(payment, options) {
  return Promise.reject(new Error('This Function is not implemented'));
};

/**
 * Execute Payment
 *
 * @abstract
 * @param {PaymentSchema}    payment
 * @param {Function, Object} options Option can be Optional
 * @param {Function}         callback
 */
PaymentAbstract.prototype.execute = function(payment, options, callback) {
  console.log('This Function is not implemented');
};

/**
 * Refund Paymaent
 *
 * @abstract
 * @param payment
 * @param {Function, Object} options Option can be Optional
 * @param {Function} callback
 */
PaymentAbstract.prototype.refund = function(payment, options, callback) {
  console.log('This Function is not implemented');
};

/**
 *
 * @param {Object}   data
 * @param {Object}   options
 * @param {Function} callback
 */
PaymentAbstract.prototype.cancel = function(data, options, callback) {
  if(!Object.hasOwnProperty.call(data, 'iTxn')) {
    return callback(new Paymnd.Error.Payment('Parameter "iTxn" is not available'));
  }

  Paymnd.Model.Transaction.Model.getByInternTxnId(data.iTxn, function(err, transactionPayment) {
    if(err) {
      return callback(new Paymnd.Error.Transaction('Payment cancel failed', null, {error: err, iTxn: data.iTxn}));
    }

    var paymentId = transactionPayment._payment._id;

    // TODO: Diese Zeilen Code sind nur da weil ich noch keine Lösung gemacht habe
    // eigentlich müssen sie in die Transaction verlegt werden
    var transaction = new Paymnd.Model.Transaction.Model({
      txn: transactionPayment.txn,
      iTxn: transactionPayment.iTxn,
      state: 'canceled',
      _payment: paymentId,
      action: 'cancel'
    });

    transaction.save(function(err) {
      if (err) return callback(new Paymnd.Error.Model('Transaction save is failed', null, {error:err, paymentId: paymentId}));
      // alles OKay
      callback(null, transactionPayment._payment);
    });
  });
};

/**
 * Middleware bind automaticaly the Payment Scope.
 *
 * Middleware can be as Function:
 *
 * and used as GET / POST
 *
 *
 * function(req, res, next) {
 *  console.log('MiddleWare is not implemented')
 * }
 *
 * Or as Object with own Get and Post Function
 *
 * {
 *  get: function(req, res, next) {
 *    ...
 *  },
 *
 *  post: function(req, res, next) {
 *    ...
 *  }
 *
 *  execute: function(req, res, next)
 *
 *  mynameofaction: function(req, res, next)
 *
 *  .....
 * }
 *
 */
PaymentAbstract.prototype.middleware = {
  get: function(req, res) {
    // this is only example and not be in use
    res.end();
  },

  post: function(req, res) {
    // this is only example and not be in use
    res.end();
  }
};

/**
 * Refund Paymaent
 *
 * @param {String} state
 * @param {String} action
 *
 * @return {String}
 */
PaymentAbstract.prototype.convertStateToStatus = function(state, action) {
  if(action && this.state.hasOwnProperty(action) && this.state[action].hasOwnProperty(state)) {
    return this.state[action][state];
  } else if(this.state.hasOwnProperty(state)) {
    return this.state[state];
  } else {
    return Status().getDefault();
  }
};

PaymentAbstract.prototype.state = {};

/**
 * Convert Price to needed Format for Vendor
 *
 * @public
 * @param {Number} price
 * @return {Number}
 */
PaymentAbstract.prototype.toCurrency = function(price) {
  return price;
};

module.exports = PaymentAbstract;