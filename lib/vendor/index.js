"use strict";

var path = require('path'),
  debug = require('debug')('paymnd:vendor:index'),
  util = require('util'),
  Paymnd = require('../'),
  extend = require('extend'),
  Promise = require('bluebird');

var _vendor = [],
  _payment = [];

var Vendor = function Vendor(name, options) {
  this.name = name;
  this.options = options || {};
  this.payments = [];
};

/**
 * Create vendor payment and return it
 *
 * @param {String} name
 * @param {Object} config
 *
 * @return {PaymentAbstract}
 */
Vendor.prototype.create = function(name, config) {
  debug('PaymentName: %s', name);

  var parentOptions = this.options,
    methodOptions = extend(true, { name: name }, config),
    options = extend(true, parentOptions, methodOptions);
    path = require.resolve('./' + this.name + '/' + name);

  debug('PaymentPath: %s', path);

  // load payment object
  var payment = require(path);
  var newPayment = new payment(options);
  newPayment.setVendor(this);

  return newPayment;
};

/**
 * Add Payment with fullNameKey
 *
 * @param {String}          name
 * @param {PaymentAbstract} payment
 *
 * @return {Vendor}
 */
Vendor.prototype.add = function(name, payment) {
  this.payments[name] = payment;
  _payment[payment.getMethod()] = payment;
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

// Module Loader of vendors and payments
module.exports = function(config) {

  for(var vendorName in config.vendor) {
    if (config.vendor.hasOwnProperty(vendorName)) {
      var vendor = config.vendor[vendorName];
      debug('Vendor: %s', vendorName);

      var newVendor = new Vendor(vendorName, vendor.option);
      _vendor[vendorName] = newVendor;

      if(vendor[vendorName]) {
        // vendor has single payment
        debug('VendorSingle: %s', vendorName);
        var singlePayment = newVendor.create(vendorName, vendor[vendorName]);
        newVendor.add(vendorName, singlePayment);
        debug('CreatePaymentMethod: %s', singlePayment.getMethod());
      } else {
        debug('VendorList: %s', vendor.method);
        // vendor has many payments
        for(var paymentName in vendor.method) {
          if (vendor.method.hasOwnProperty(paymentName)) {
            var payment = newVendor.create(paymentName, vendor.method[paymentName]);
            newVendor.add(paymentName, payment);
          }
        }
      }

      debug('---');
    }
  }

  return {
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
      return _payment[name];
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
     * {
     *   orderId: String, // required
     *   amount: Number,  // required - es wird nur ein Integer akzeptiert, alle Preise müssen in Cent übergeben werden
     *   method: String, // required
     *   currency: String // optional
     * }
     *
     * @param {Object} options
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
        method: paymentObj.getName()
      }, data);

      debug('paymentCreate:newPaymentData', newPaymentData);

      // TODO: check if Method empty then throws error

      return Promise.resolve()
        .then(function() {
          return new Promise(function(res, rej) {
            Paymnd.Model.Payment.Model.create(newPaymentData, function(err, payment) {
              err && rej(err) || res(payment);
            });
          });
        })
        .then(function(payment) {
          return paymentObj.create(payment, options);
        })
        .catch(function(err) {
          debug('Error on Payment Create:', err.stack);
          return new Paymnd.Error.Model('Could not create Payment', null, {error:err, data:data});
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
      var _this = this;

      var promise = new Promise(function(res, rej) {
        Paymnd.Model.Payment.Model.getByOrderId(orderId, function(err, payment) {
          if(err) {
            rej(err);
          } else {
            res(payment);
          }
        });
      });

      return promise.then(function(payment) {
        return _this
          .getVendor(payment.vendor)
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
      var _this = this;

      var promise = new Promise(function(res, rej) {
        Paymnd.Model.Payment.Model.getByOrderId(orderId, function(err, payment) {
          if(err) {
            rej(err);
          } else {
            res(payment);
          }
        });
      });

      return promise.then(function(payment) {
        return _this
          .getVendor(payment.vendor)
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
      var _this = this;

      var promise = new Promise(function(res, rej) {
        Paymnd.Model.Payment.Model.getByOrderId(orderId, function(err, payment) {
          if(err) {
            rej(err);
          } else {
            res(payment);
          }
        });
      });

      return promise.then(function(payment) {
        return _this
          .getVendor(payment.vendor)
          .get(payment.method)
          .refund(payment);
      });
    }
  };
};