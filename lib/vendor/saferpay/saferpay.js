"use strict";

var util = require('util'),
  url = require('url'),
  querystring = require('querystring'),
  Payment = require('../payment'),
  Paymnd = require('../..'),
  Promise = require('bluebird'),
  debug = require('debug')('paymnd:vendor:saferpay'),
  Request = require('request-promise'),
  Status = require('../../status');

var SaferPayPayment = function(options) {
  this.options = util._extend({title:'SafePay'}, options);
  Payment.call(this, this.options);
};
util.inherits(SaferPayPayment, Payment);

SaferPayPayment.prototype.middleware = {

  execute: function(req, res) {
    var redirectUrl = this.getVendor().options.redirectUrl;

    this.execute(req.query)
      .then(function(payment) {
        res.redirect(url.resolve('/', redirectUrl.success)  + '?orderId=' + payment.orderId || 0);
      })
      .catch(function() {
        res.redirect(url.resolve('/', redirectUrl.error) + '?orderId=' + req.query.orderId || 0);
      });
  },

  error: function(req, res) {
    var redirectUrl = this.getVendor().options.redirectUrl;

    this.cancel(req.query)
      .then(function(payment) {
        res.redirect(url.resolve('/', redirectUrl.cancel) + '?orderId=' + payment.orderId || 0);
      })
      .catch(function() {
        res.redirect(url.resolve('/', redirectUrl.error) + '?orderId=' + req.query.orderId || 0);
      });
  },

  cancel: function(req, res) {
    var redirectUrl = this.getVendor().options.redirectUrl;

    this.cancel(req.query)
      .then(function(payment) {
        res.redirect(url.resolve('/', redirectUrl.cancel) + '?orderId=' + payment.orderId || 0);
      })
      .catch(function() {
        res.redirect(url.resolve('/', redirectUrl.error) + '?orderId=' + req.query.orderId || 0);
      });
  }
};

/**
 * @param {object} payment
 *
 * @returns {Promise}
 */
SaferPayPayment.prototype.create = function(payment) {
  debug('SaferPayPayment.create#payment: %o', payment);

  var executeUrl = url.format({
    protocol: this.getConfig().ping.url.protocol,
    host: this.getConfig().ping.url.host,
    pathname: this.getMiddlewarePath('execute'),
    query: {
      orderId: payment.orderId
    }
  });
  var errorUrl = url.format({
    protocol: this.getConfig().ping.url.protocol,
    host: this.getConfig().ping.url.host,
    pathname: this.getMiddlewarePath('error'),
    query: {
      orderId: payment.orderId
    }
  });
  var cancelUrl = url.format({
    protocol: this.getConfig().ping.url.protocol,
    host: this.getConfig().ping.url.host,
    pathname: this.getMiddlewarePath('cancel'),
    query: {
      orderId: payment.orderId
    }
  });

  // **************************************************
  // *
  // * Put all params together
  // * for hosting: each param which could have non-url-conform characters inside should be urlencoded before
  // *
  var query = {

    // **************************************************
    // * Mandatory attributes
    // **************************************************
    ACCOUNTID: this.options.accountId,
    CURRENCY: this.options.currency,
    AMOUNT: payment.amount,
    SUCCESSLINK: executeUrl,
    FAILLINK: errorUrl,
    BACKLINK: cancelUrl,

    // **************************************************
    // * Important (but optional) attributes
    // **************************************************
    ORDERID: payment.orderId
  };

  // **************************************************
  // * Additional params
  // **************************************************
  query = util._extend(query, this.options.query || {});

  var payInitUrl = url.format(
    util._extend(
      url.parse(
        this.options.gateway.payInit
      ), {query: query}
    )
  );

  debug('SaferPayPayment.create#query: %o', query);
  debug('SaferPayPayment.create#initLink: %s', payInitUrl);


  return Paymnd.Model.Transaction.create({
      _payment: payment._id
    })
    .save()
    .then(function() {
      return Request(payInitUrl)
        .then(function(response) {
          return { status: 'OK', redirect:  response};
        });
    }).catch(function(err) {
      throw new Paymnd.Error.Transaction('Create SaferPay payment failed', null, {error: err, paymentId: payment._id});
    });
};

/**
 * @param {object} query
 *
 * @returns {Promise}
 */
SaferPayPayment.prototype.execute = function(query) {
  var _this = this;
  var payment;

  return Promise.resolve()
    .then(function() {
      return new Promise(function(res, rej) {
        Paymnd.Model.Payment.Model.getByOrderId(query.orderId, function(err, transactionPayment) {
          debug('SaferPayPayment.execute#transactionPayment:', transactionPayment);

          err ? rej(err) : res(transactionPayment);
        });
      });
    })
    .then(function(transactionPayment) {
      debug('SaferPayPayment.execute#createTransaction:');

      payment = transactionPayment;

      return Paymnd.Model.Transaction.execute({
          _payment: transactionPayment._id,
          state: Status.PENDING
        })
        .save();
    })
    .then(function() {
      var payConfirmUrl = url.format(
        util._extend(
          url.parse(
            _this.options.gateway.payConfirm
          ), {
            query: {
              DATA: query.DATA,
              SIGNATURE: query.SIGNATURE
            }
          }
        )
      );

      debug('SaferPayPayment.execute#payConfirmUrl: %s', payConfirmUrl);

      return Request(payConfirmUrl)
        .then(function(response) {
          console.log('SaferPayPayment.execute#CONFIRM_SUCCESS:', response);

          var responseQuery = querystring.parse(response.replace('OK:', 'STATUS=OK&'));

          if(responseQuery.STATUS && responseQuery.STATUS === 'OK') {
            return responseQuery;
          } else {
            throw new Error('You have an error on SaferPay Confirmation with OrderID: ' + query.orderId);
          }
        });
    })
    .then(function(responseQuery) {
      var nQuery = {
        ACCOUNTID: _this.options.accountId,
        ID: responseQuery.ID,
        TOKEN: responseQuery.TOKEN
      };

      if(_this.options.spPassword) {
        nQuery.spPassword = _this.options.spPassword
      }

      var payCompleteUrl = url.format(
        util._extend(
          url.parse(
            _this.options.gateway.payComplete
          ), {
            query: nQuery
          }
        )
      );

      debug('SaferPayPayment.execute#payCompleteUrl: %s', payCompleteUrl);

      return Request(payCompleteUrl)
        .then(function(response) {
          if(response !== 'OK') {
            throw new Error('You have an error on SaferPay Complete with OrderID: ' + query.orderId);
          }
        })
        .then(function() {
          debug('SaferPayPayment.execute#createCompleteTransaction:');

          return Paymnd.Model.Transaction.execute({
              _payment: payment._id,
              state: Status.DEBIT
            })
            .save();
        })
    })
    .then(function() {
      return payment;
    })
    .catch(function(err) {
      throw new Paymnd.Error.Transaction('SaferPay Payment execute failed', null, {error: err, orderId: query.orderId});
    });
};

/**
 * @param {object} query
 *
 * @returns {Promise}
 */
SaferPayPayment.prototype.cancel = function(query) {

  return Promise.resolve()
    .then(function() {
      return new Promise(function(res, rej) {
        Paymnd.Model.Payment.Model.getByOrderId(query.orderId, function(err, transactionPayment) {
          debug('SaferPayPayment.cancel#transactionPayment:', transactionPayment);

          err ? rej(err) : res(transactionPayment);
        });
      });
    })
    .then(function(payment) {
      debug('SaferPayPayment.cancel#createTransaction:');

      return Paymnd.Model.Transaction.cancel({
          _payment: payment._id,
          state: Status.CANCEL
        })
        .save()
        .then(function() {
          return payment;
        });
    });
};

/**
 * @type {action: {state: state}}
 */
SaferPayPayment.prototype.state = {
  refund: Status.REFUND,
  create: Status.CREATE,
  debit: Status.DEBIT,
  cancel: Status.CANCEL,
  pending: Status.PENDING
};

module.exports = SaferPayPayment;