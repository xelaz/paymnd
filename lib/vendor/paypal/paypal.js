"use strict";

var paypal = require('paypal-rest-sdk'),
  debug = require('debug')('paymnd:vendor:paypal'),
  util = require('util'),
  PaymentAbstract = require('../payment'),
  Paymnd = require('../..'),
  Error = require('../../error'),
  Promise = require('bluebird'),
  Status = require('../../status'),
  url = require('url');

class PaypalPayment extends PaymentAbstract {

  constructor(options) {
    super(options);

    this.middleware = {
      execute: function(req, res) {
        var redirectUrl = this.getVendor().options.redirectUrl;

        this.execute(req.query)
          .then(function(payment) {
            res.redirect(url.resolve('/', redirectUrl.success)  + '?orderId=' + payment.orderId || 0);
          })
          .catch(function(err) {
            res.redirect(url.resolve('/', redirectUrl.error) + '?orderId=' + req.query.orderId || 0);
          });
      },

      cancel: function(req, res) {
        var redirectUrl = this.getVendor().options.redirectUrl;

        this.cancel(req.query)
          .then(function(payment) {
            res.redirect(url.resolve('/', redirectUrl.cancel) + '?orderId=' + payment.orderId || 0);
          })
          .catch(function(err) {
            res.redirect(url.resolve('/', redirectUrl.error) + '?orderId=' + req.query.orderId || 0);
          });
      }
    };

    this.state = {
      refund: {
        "pending": Status.PENDING,
        "completed": Status.REFUND,
        "failed": Status.ERROR
      },

      create: {
        'created': Status.CREATE,
        'approved': Status.DEBIT,
        'failed': Status.ERROR,
        'canceled': Status.CANCEL,
        "pending": Status.PENDING,
        'expired': Status.ERROR
      },

      execute: {
        'created': Status.CREATE,
        'approved': Status.DEBIT,
        'failed': Status.ERROR,
        'canceled': Status.CANCEL,
        "pending": Status.PENDING,
        'expired': Status.ERROR
      },

      cancel: {
        canceled: Status.CANCEL
      },

      get: {
        "pending": Status.PENDING,
        "completed": Status.DEBIT,
        "refunded": Status.REFUND,
        "partially_refunded": Status.PARTIAL_REFUND
      }
    };
  }

  init() {
    paypal.configure(this.options.api);
  }

  /**
   *
   * @returns {{payment_method: string}}
   */
  createPayerData() {
    return {
      "payment_method": "paypal"
    }
  };

  /**
   *
   * @param {PaymentSchema} payment
   * @param {Object}        options
   *
   * @return {Promise<T>}
   */
  create(payment, options) {
    var _this = this;
    var iTxn = payment._id + '';

    var paypalData = {
      "intent": "sale",
      "payer": this.createPayerData(options),
      "redirect_urls": {},
      "transactions": [{
        "amount": {
          "currency": this.options.currency,
          "total": this.toCurrency(payment.amount),
          details: {
            //tax: 1.99   // steuer anteil
          }
        },
        "description": options.order.description,
        "item_list": {
          items: this.prepareItem(options.order.itemList)
        }
      }]
    };

    // approvalUrl
    paypalData.redirect_urls.return_url = url.format( {
      protocol: this.getConfig().ping.url.protocol,
      host: this.getConfig().ping.url.host,
      pathname: this.getMiddlewarePath('execute'),
      query: {
        orderId: payment.orderId,
        iTxn: iTxn
      }
    });

    // cancel
    paypalData.redirect_urls.cancel_url = url.format({
      protocol: this.getConfig().ping.url.protocol,
      host: this.getConfig().ping.url.host,
      pathname: this.getMiddlewarePath('cancel'),
      query: {
        orderId: payment.orderId,
        iTxn: iTxn
      }
    });

    debug('PaypalPayment.create#iTxn: %s', iTxn);
    debug('PaypalPayment.create#payment: %o', payment);
    debug('PaypalPayment.create#paypalData: %o', paypalData);

    var create = new Promise(function(res, rej) {
      paypal.payment.create(paypalData, {}, function(err, response) {
        err && rej(err) || res(response);
      })
    });

    return create
      .then(function(response) {
        debug('paypal.payment.create#response: %o', response);

        var redirect = '';

        switch(response.state) {
          case 'created':
            var link = response.links;
            for (var i = 0; i < link.length; i++) {
              if (link[i].rel === 'approval_url') {
                redirect = link[i].href;
              }
            }
            break;

          // on credit card payment go direct to success page payment
          case 'approved':
            redirect = url.format({
              protocol: _this.this.getConfig().ping.url.protocol,
              host: _this.this.getConfig().ping.url.host,
              pathname: _this.options.redirectUrl.success,
              query: {
                method: _this.getMethod(),
                orderId: payment.orderId
              }
            });
            break;
        }

        return Paymnd.Model.Transaction.create({
            eTxn: response.id,
            response: response,
            state: response.state,
            _payment: payment._id
          })
          .then(function() {
            debug('PaypalPayment.create#saveTransaction:', redirect);

            return { status: 'OK', redirect:  redirect};
          });
      });
  };

  /**
   * Send to Paypal and write update state
   *
   * @param {Object}   query
   *
   * @return {Promise}
   */
  execute(query) {
    debug('PaypalPayment.execute(query: %o)', query);

    return Promise.resolve()
      .then(function() {
        if(!query.iTxn) {
          throw new Error.PaymentError('Parameter "iTxn" is not available');
        }
      })
      .then(function() {
        return Paymnd.Model.Payment.getById(query.iTxn);
      })
      .then(function(payment) {
        debug('PaypalPayment.execute#transactionPayment: %o', payment);
        return new Promise(function(res, rej) {
          var payer = { payer_id : query.PayerID || 0 };
          var iTxn = payment._id + '';

          paypal.payment.execute(query.paymentId, payer, {}, function (err, response) {
            debug('paypal.payment.execute#resp:', response);

            if(err) {
              return rej(new Error.TransactionError('Paypal API execute failed', null, { error: err, paymentId: iTxn }));
            } else {
              res(response);
            }
          });
        })
          .then(function(response) {
            return Paymnd.Model.Transaction.execute({
                txn: response.id,
                response: response,
                request: query,
                state: response.state,
                _payment: query.iTxn
              })
              .then(function() {
                return payment;
              });
          });
      });
  };

  /**
   * @param {PaymentSchema} payment
   *
   * @return {Promise}
   */
  refund(payment) {
    debug('PaypalPayment.refund#payment: %o', payment);
    var paymentId = payment._id;

    Paymnd.Model.Transaction.getTransactionByCondition({_payment: {$eq :paymentId}, 'response.state': 'approved'})
      .then((payment) => {
        if(payment) {
          return {saleId: payment.response.transactions[0].related_resources[0].sale.id, iTxn: payment.iTxn};
        } else {
          throw new Error.ModelError('Transaction with PaymentId "' + payment._id + '" was not found');
        }
      })
      .then(function(result) {
        debug('PaypalPayment.refund#result: %o', result);

        return new Promise(function(res, rej) {
          paypal.sale.refund(result.saleId, {}, {}, function(err, response) {
            if(err) {
              return rej(new Error.TransactionError('Refund Payment call failed', null, {error: err, paymentId: paymentId}));
            }

            return Paymnd.Model.Transaction.refund({
              eTxn: response.id,
              response: response,
              state: response.state,
              _payment: payment._id
            });
          });
        });
      })
      .then(function() {
        return payment;
      });
  };

  /**
   * @param {Object}   query
   *
   * @return {Promise}
   */
  cancel(query) {
    debug('PaypalPayment.cancel#query: %o', query);

    return Promise.resolve()
      .then(function() {
        if(!query.iTxn) {
          return new Error('Parameter "iTxn" is not available');
        }
      })
      .then(function() {
        return Paymnd.Model.Payment.getById(query.iTxn);
      })
      .then(function(payment) {
        return Paymnd.Model.Transaction.cancel({
            _payment: payment._id,
            state: 'canceled'
          })
          .then(function() {
            return payment;
          });
      });
  };

  /**
   * Get Status info from Payment direct
   * @param {String} txn Paypal txn
   *
   * @return {Promise<T>}
   */
  get(txn) {
    return new Promise(function(res, rej) {
      paypal.payment.get(txn, {}, function(err, resp) {
        if(err) {
          return rej(err);
        }

        res(resp);
      });
    });
  };

  /**
   * Add default Currency to the Paypal item list
   *
   * @param {Array}  items
   * @param {String} currency
   *
   * @returns {Object}
   */
  prepareItem(items, currency) {
    var cur = currency || this.getCurrency(),
      _this = this;

    items.forEach(function(item) {
      // ad default currency if not set
      if(!item.currency) {
        item.currency = cur;
      }

      // fix price to float(7,2)
      item.price = _this.toCurrency(item.price);
    });

    return items;
  };

  /**
   * Convert Price to Paypal Format
   *
   * @public
   *
   * @param {Number} price
   *
   * @return {String}
   */
  toCurrency(price) {
    return (price/100).toFixed(2);
  };
}

module.exports = PaypalPayment;