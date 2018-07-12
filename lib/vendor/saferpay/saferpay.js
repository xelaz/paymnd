"use strict";

var util = require('util'),
  url = require('url'),
  querystring = require('querystring'),
  PaymentAbstract = require('../payment'),
  Paymnd = require('../..'),
  Error = require('../../error'),
  Promise = require('bluebird'),
  debug = require('debug')('paymnd:vendor:saferpay'),
  Request = require('request-promise'),
  Status = require('../../status'),
  parseString = require('xml2js').parseString;

class SaferPayPayment extends PaymentAbstract {

  constructor(options) {
    super(options);

    /**
     * @type {action: {state: state}}
     */
    this.state = {
      refund: Status.REFUND,
      create: Status.CREATE,
      debit: Status.DEBIT,
      cancel: Status.CANCEL,
      pending: Status.PENDING
    };

    this.middleware = {
      execute: function (req, res) {
        const redirectUrl = this.getVendor().options.redirectUrl;

        this.execute(req.query)
          .then(function (payment) {
            res.redirect(url.resolve('/', redirectUrl.success) + '?orderId=' + payment.orderId || 0);
          })
          .catch(function () {
            res.redirect(url.resolve('/', redirectUrl.error) + '?orderId=' + req.query.orderId || 0);
          });
      },
      error: function (req, res) {
        const redirectUrl = this.getVendor().options.redirectUrl;

        this.cancel(req.query)
          .then(function (payment) {
            res.redirect(url.resolve('/', redirectUrl.cancel) + '?orderId=' + payment.orderId || 0);
          })
          .catch(function () {
            res.redirect(url.resolve('/', redirectUrl.error) + '?orderId=' + req.query.orderId || 0);
          });
      },
      cancel: function (req, res) {
        const redirectUrl = this.getVendor().options.redirectUrl;

        this.cancel(req.query)
          .then(function (payment) {
            res.redirect(url.resolve('/', redirectUrl.cancel) + '?orderId=' + payment.orderId || 0);
          })
          .catch(function () {
            res.redirect(url.resolve('/', redirectUrl.error) + '?orderId=' + req.query.orderId || 0);
          });
      }
    }
  }

  /**
   * @param {object} payment
   *
   * @returns {Promise}
   */
  create(payment) {
    debug('SaferPayPayment.create#payment: %o', payment);

    const executeUrl = url.format({
      protocol: this.getConfig().ping.url.protocol,
      host: this.getConfig().ping.url.host,
      pathname: this.getMiddlewarePath('execute'),
      query: {
        orderId: payment.orderId
      }
    });
    const errorUrl = url.format({
      protocol: this.getConfig().ping.url.protocol,
      host: this.getConfig().ping.url.host,
      pathname: this.getMiddlewarePath('error'),
      query: {
        orderId: payment.orderId
      }
    });
    const cancelUrl = url.format({
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
    const query = util._extend({
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
    },
      // **************************************************
      // * Additional params
      // **************************************************
      this.options.query || {});

    const payInitUrl = url.format(
      util._extend(
        url.parse(
          this.options.gateway.payInit
        ), {query: query}
      )
    );

    debug('SaferPayPayment.create#query: %o', query);
    debug('SaferPayPayment.create#initLink: %s', payInitUrl);

    return Paymnd.Model.Transaction.create({_payment: payment._id})
      .then(function () {
        return Request(payInitUrl)
          .then(function (response) {
            return {status: 'OK', redirect: response};
          });
      }).catch(function (err) {
        throw new Error.TransactionError('Create SaferPay payment failed', null, {error: err, paymentId: payment._id});
      });
  };

  /**
   * @param {object} query
   *
   * @returns {Promise}
   */
  execute(query) {
    var _this = this;
    var payment;
    var xmlData = {};

    return Paymnd.Model.Payment.getByOrderId(query.orderId)
    // create pending status
      .then((transactionPayment) => {
        debug('SaferPayPayment.execute#createTransaction:');

        payment = transactionPayment;

        return Paymnd.Model.Transaction.execute({_payment: payment._id});
      })
      // verify payment with request
      .then(() => {
        return new Promise((res, rej) => {
          parseString(query.DATA, (err, result) => {
            err ? rej(err) : res(result);
          });
        })
          .then((xmlJson) => {
            xmlData = xmlJson.IDP.$;

            if (_this.options.accountId != xmlData.ACCOUNTID
              || payment.amount != xmlData.AMOUNT
              || payment.currency != xmlData.CURRENCY) {
              throw new Error('Payment is not valid with request from saferpay');
            }
          });
      })
      .then(function () {
        // send request to saferpay
        var payConfirmUrl = url.format(
          Object.assign(
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
          .then(function (response) {
            debug('SaferPayPayment.execute#CONFIRM_SUCCESS:', response);

            var responseQuery = querystring.parse(response.replace('OK:', 'STATUS=OK&'));

            if (responseQuery.STATUS && responseQuery.STATUS === 'OK') {
              return responseQuery;
            } else {
              throw new Error('You have an error on SaferPay Confirmation with OrderID: ' + query.orderId);
            }
          });
      })
      .then(function (responseQuery) {
        var nQuery = {
          ACCOUNTID: _this.options.accountId,
          ID: responseQuery.ID,
          TOKEN: responseQuery.TOKEN
        };

        if (_this.options.spPassword) {
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
          .then(function (response) {
            if (response !== 'OK') {
              throw new Error('You have an error on SaferPay Complete with OrderID: ' + query.orderId);
            }
          })
          .then(function () {
            debug('SaferPayPayment.execute#createCompleteTransaction:');

            return Paymnd.Model.Transaction.execute({
              _payment: payment._id,
              state: Status.DEBIT,
              eTxn: responseQuery.ID,
              response: {
                executeQuery: query,
                completeQuery: responseQuery,
                xmlData: xmlData
              }
            });
          })
      })
      .then(function () {
        return payment;
      })
      .catch(function (err) {
        debug('SaferPayPayment.execute failed: %s', err.stack);

        throw new Error.TransactionError('SaferPay Payment execute failed', null, {error: err, orderId: query.orderId});
      });
  };

  /**
   * @param {object} query
   *
   * @returns {Promise}
   */
  cancel(query) {
    return Promise.resolve()
      .then(function () {
        return Paymnd.Model.Payment.getByOrderId(query.orderId);
      })
      .then(function (payment) {
        debug('SaferPayPayment.cancel#createTransaction:');

        return Paymnd.Model.Transaction.cancel({
          _payment: payment._id,
          state: Status.CANCEL
        })
          .then(function () {
            return payment;
          });
      });
  }
}

module.exports = SaferPayPayment;