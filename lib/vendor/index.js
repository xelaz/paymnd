"use strict";

var path = require('path'),
  debug = require('debug')('payme:vendor:index'),
  util = require('util'),
  PayMe = require('../'),
  extend = require('extend'),
  async = require('async');

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
    methodOptions = util._extend({ name: name }, config),
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
    getMethod: function(name) {
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
     * @param {Function} callback
     */
    paymentCreate: function(data, options, callback) {

      var paymentObj = this.getMethod(data.method);
      // TODO: check if Method empty then throws error

      async.waterfall([
        function(callback) {
          PayMe.Model.Payment.Model.findOne({orderId: data.orderId}, callback);
        },
        function(doc, callback) {
          // add vendor and his payment method
          var newPayment = util._extend(data, {
            vendor: paymentObj.getVendor().getName(),
            method: paymentObj.getName(),
            gaga: 1
          });

          newPayment.currency = newPayment.currency || paymentObj.getCurrency();

          // if document exist then only update it
          if(doc) {
            Object.keys(newPayment).forEach(function(key) {
              if(typeof doc[key]) {
                doc[key] = newPayment[key];
              }
            });

            doc.save(function(err) {
              /*if(err) {
                callback(err);
              } else {
                callback(null, doc);
              }*/
              err && callback(err) || callback(null, doc);
            });
            return;
          }

          PayMe.Model.Payment.Model.create(newPayment, callback);
        }
      ], function (err, doc) {
        if(err) {
          return callback(new PayMe.Error.Model('Could not create Payment', null, {error:err, data:data}));
        }

        // create transaction
        paymentObj.create(doc, options, callback);
      });
    },

    /**
     * This Function execute the Payment,
     * need for Paypal
     *
     * @param {Object} data
     * {
     *   vendor: VendorName,
     *   method: MethodName,
     *   iTxn: InternTxnId
     * }
     *
     *
     * @param {Object} options Optional
     * @param {Function} callback
     */
    paymentExecute: function(data, options, callback) {

      var vendor = this.getVendor(data.vendor);
      // TODO: check valid vendor

      var method = vendor.get(data.method);
      // TODO check valid method

      method.execute(data, options, callback);
    },

    /**
     * @param {Object} data
     * {
     *   iTxn: InternTxnId, OR
     *   paymentId: Object Id OR
     *   orderId: OrderId from system
     * }
     *
     * @param {Object} options
     * @param {Function} callback
     */
    paymentRefund: function(data, options, callback) {
      var _this = this;
      // first at orderId
      PayMe.Model.Payment.Model.getByOrderId(data.orderId, function(err, payment) {
        if(err) {
          return callback(err);
        }

        if(!payment) {
          return callback(new PayMe.Error.Model('Payment not found for refund', null, {data:data}));
        }

        // TODO: check valid vendor
        var vendor = _this.getVendor(payment.vendor);

        // TODO check valid method
        var method = vendor.get(payment.method);

        method.refund(payment, options, callback);
      });
    }
  };
};