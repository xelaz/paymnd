"use strict";

var path = require('path'),
  debug = require('debug')('paymnd:vendor:index'),
  util = require('util'),
  Paymnd = require('../'),
  extend = require('extend'),
  Error = require('../error');

var _vendor = [],
  _payment = [];

var Vendor = function Vendor(name, vendorData) {
  debug('Vendor: %s', name);
  this.name = name;
  this.options = vendorData.options || {};
  this.payments = [];

  if(!vendorData.method) { // vendor has single payment
    this.add(this.createPayment(name, vendorData));
  } else { // vendor has multiple payments
    Object.keys(vendorData.method).forEach((payment) => {
      this.add(this.createPayment(payment, vendorData.method[payment]));
    });
  }
};

/**
 * Create vendor payment and return it
 *
 * @param {String} name
 * @param {Object} config
 *
 * @return {PaymentAbstract}
 */
Vendor.prototype.createPayment = function(name, config) {
  debug('Vendor.createPayment: %o', config);

  var parentOptions = Object.assign({}, this.options),
    methodOptions = Object.assign({methodName: name}, config),
    options = Object.assign(parentOptions, methodOptions),
    path = require.resolve('./' + this.name + '/' + name);

  debug('Payment: %s\n  %o', path, options);

  // load payment object
  var payment = require(path);
  var newPayment = new payment(options);
  newPayment.setVendor(this);
  debug('Vendor.create: %s', newPayment.getMethodName());

  return newPayment;
};

/**
 * Add Payment with fullNameKey
 *
 * @param {PaymentAbstract} payment
 *
 * @return {Vendor}
 */
Vendor.prototype.add = function(payment) {
  this.payments[payment.getMethodName()] = payment;
  _payment[payment.getMethodName()] = payment;
  return this;
};

/**
 * Get Vendor Payment by fullNameKey
 *
 * @param {String} name
 *
 * @returns {PaymentAbstract}
 */
Vendor.prototype.get = function(name) {
  return this.payments[name];
};

/**
 * Get full list
 * *
 * @returns {PaymentAbstract}
 */
Vendor.prototype.getPayments = function() {
  return this.payments;
};

/**
 * @returns {String}
 */
Vendor.prototype.getName = function() {
  return this.name;
};

module.exports = {

  // Module Loader of vendors and payments
  load: function (config) {

    Object.keys(config.vendor).forEach(function(vendorName) {
      _vendor[vendorName] = new Vendor(vendorName, config.vendor[vendorName]);

      debug('-------------------------------------------------------');
    });
  },

  /**
   * Get Vendor byname
   *
   * @param name
   * @returns {*}
   */
  getVendor: function(name) {
    return _vendor[name];
  },

  /**
   * Get registred vendor names
   * @returns {Array}
   */
  getVendorKeys: function() {
    return Object.keys(_vendor);
  },

  /**
   * Get Payment method type
   *
   * @param name
   * @returns {PaymentAbstract}
   */
  getByMethod: function(name) {
    if(_payment[name]) {
      return _payment[name];
    } else {
      throw new Error('Payment with method "' + name + '" was not found');
    }
  },

  /**
   * Get registred payment method type keys
   *
   * @returns {Array}
   */
  getMethodKeys: function() {
    return Object.keys(_payment);
  },

  /**
   * Get registred payment method keys
   *
   * @returns {Object}
   */
  getMethodTitles: function() {
    var keys = {};

    for(var key in _payment) {
      keys[key] = _payment[key].getTitle();
    }

    return keys;
  },

  /**
   * @param {Object} data
   * @param {String} data.orderId   to identify the payment
   * @param {Number} data.amount    all prices only in cent value
   * @param {String} [data.curency] if not set, then get default from config
   *
   * @param {Object} [options]
   * {
   *   order: { // Order Details
   *     description: String, // short order description
   *     itemList: [{ // this list is needed for paypal
   *       quantity: Number,
   *       name: String,
   *       price: Number, // es wird nur ein Integer akzeptiert, alle Preise müssen in Cent übergeben werden
   *       currency: String // optional, when nicht gesetzt mach die Vendor Method Paypal es automatisch
   *     }]
   *   },
   *   // if we have creditcard data
   *   creditcard: {
   *     number: String, //
   *     cvv2: Number|String,
   *     type: String,
   *     expireYear: Number|String
   *     expireMonth: Number|String
   *   },
   *   // Customer is obligate with all Params
   *   customer: {
   *     id: 4234567894,
   *     firstName: 'Alexander',
   *     lastName: 'Tester',
   *     ip: '62.157.236.170'
   *   }
   * }
   *
   * @return {Promise}
   */
  paymentCreate: function(data, options) {
    var paymentObj = this.getByMethod(data.method);
    // add vendor and his payment method
    var newPaymentData = extend(true, {
      currency: paymentObj.getCurrency(),
      vendor: paymentObj.getVendor().getName(),
      method: paymentObj.getMethodName()
    }, data);

    debug('paymentCreate:newPaymentData: %o', newPaymentData);

    return Paymnd.Model.Payment.create(newPaymentData)
      .then(function(payment) {
        return paymentObj.create(payment, options);
      })
      .catch(function(err) {
        debug('Error on Payment Create:', err.stack);
        // fire and forget
        Paymnd.Model.Error.log(err).then(function() {
          throw new Error.PaymentError('Could not create Payment: ', null, { error:err, data:data });
        });
      });
  },

  /**
   * This Function execute the Payment and debit payment
   *
   * @param {string|number} orderId
   *
   * @return {Promise}
   */
  paymentExecute: function(orderId) {
    return Paymnd.Model.Payment.getByOrderId(orderId)
      .then((payment) => {
        return this.getVendor(payment.vendor)
          .get(payment.method)
          .execute(payment);
      });
  },

  /**
   * This Function execute the Payment and debit payment
   *
   * @param {string|number} orderId
   *
   * @return {Promise}
   */
  paymentCancel: function(orderId) {
    return Paymnd.Model.Payment.getByOrderId(orderId)
      .then((payment) => {
        debug('paymentCancel().then(payment: %o)', payment);

        return this.getVendor(payment.vendor)
          .get(payment.method)
          .cancel(payment);
      });
  },

  /**
   * @param {string|number} orderId
   *
   * @return {Promise}
   */
  paymentRefund: function(orderId) {
    debug('paymentRefund(orderId: %s)', orderId);

    return Paymnd.Model.Payment.getByOrderId(orderId)
      .then((payment) => {
        debug('paymentRefund().then(payment: %o)', payment);

        return this.getVendor(payment.vendor)
          .get(payment.method)
          .refund(payment);
      });
  }
};