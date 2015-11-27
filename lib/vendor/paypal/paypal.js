"use strict";

var paypal = require('paypal-rest-sdk'),
  debug = require('debug')('paymnd:vendor:paypal'),
  util = require('util'),
  PaymentAbstract = require('../payment'),
  Paymnd = require('../..'),
  Promise = require('bluebird'),
  Status = require('../../status'),
  url = require('url');

/**
 * @param {object} options
 * @constructor
 */
var PaypalPayment = function PaypalPayment(options) {
  this.options = util._extend({title:'Paypal'}, options);
  paypal.configure(this.options.api);
  debug('PaypalPayment.constructor:#options', JSON.stringify(options, null, 2));
  PaymentAbstract.call(this, this.options);
};
util.inherits(PaypalPayment, PaymentAbstract);


PaypalPayment.prototype.middleware = {

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

/**
 *
 * @returns {{payment_method: string}}
 */
PaypalPayment.prototype.createPayerData = function() {
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
PaypalPayment.prototype.create = function(payment, options) {
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
        .save()
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
PaypalPayment.prototype.execute = function(query) {

  debug('PaypalPayment.execute#query: %o', query);

  return Promise.resolve()
    .then(function() {
      if(!query.iTxn) {
        throw new Paymnd.Error.Payment('Parameter "iTxn" is not available');
      }
    })
    .then(function() {
      return new Promise(function(res, rej) {
        Paymnd.Model.Payment.Model.getById(query.iTxn, function(err, payment) {
          debug('PaypalPayment.execute#transactionPayment: %o', payment);

          err ? rej(err) : res(payment);
        });
      });
    })
    .then(function(payment) {
      return (new Promise(function(res, rej) {
        var payer = { payer_id : query.PayerID || 0 };
        var iTxn = payment._id + '';

        paypal.payment.execute(query.paymentId, payer, {}, function (err, response) {
          debug('paypal.payment.execute#resp:', response);

          if(err) {
            return rej(new Paymnd.Error.Transaction('Paypal API execute failed', null, { error: err, paymentId: iTxn }));
          } else {
            res(response);
          }
        });
      }))
      .then(function(response) {
        return Paymnd.Model.Transaction.execute({
            txn: response.id,
            response: response,
            request: query,
            state: response.state,
            _payment: query.iTxn
          })
          .save()
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
PaypalPayment.prototype.refund = function(payment) {
  debug('PaypalPayment.refund#payment: %o', payment);

  var promise = new Promise(function(res, rej) {

    Paymnd.Model.Transaction.Model.getPaypalSaleId(payment._id, function(err, result) {
      if(err) {
        rej(err);
      } else {
        res(result);
      }
    });
  });

  return promise.then(function(result) {
    debug('PaypalPayment.refund#result: %o', result);

    return new Promise(function(res, rej) {
      paypal.sale.refund(result.saleId, {}, {}, function(err, response) {
        if(err) {
          return rej(new Paymnd.Error.Transaction('Refund Payment call failed', null, {error: err, paymentId: payment._id}));
        }

        return Paymnd.Model.Transaction.refund({
            eTxn: response.id,
            response: response,
            state: response.state,
            _payment: payment._id
          })
          .save()
          .then(function() {
            return payment;
          });
      });
    });
  });
};

/**
 * @param {Object}   query
 *
 * @return {Promise}
 */
PaymentAbstract.prototype.cancel = function(query) {
  debug('PaypalPayment.cancel#query: %o', query);

  return Promise.resolve()
    .then(function() {
      if(!query.iTxn) {
        return new Error('Parameter "iTxn" is not available');
      }
    })
    .then(function() {
      return new Promise(function(res, rej) {
        Paymnd.Model.Payment.Model.getById(query.iTxn, function(err, payment) {
          debug('PaypalPayment.cancel#transactionPayment: %o', payment);

          err ? rej(err) : res(payment);
        });
      });
    })
    .then(function(payment) {

      return Paymnd.Model.Transaction.cancel({
          _payment: payment._id,
          state: 'canceled'
        })
        .save()
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
PaypalPayment.prototype.get = function(txn) {

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
PaypalPayment.prototype.prepareItem = function(items, currency) {
  var cur = currency || this.options.currency,
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
 * @type {action: {state: string}}
 */
PaypalPayment.prototype.state = {
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

/**
 * Convert Price to Paypal Format
 *
 * @public
 *
 * @param {Number} price
 *
 * @return {String}
 */
PaypalPayment.prototype.toCurrency = function(price) {
  return (price/100).toFixed(2);
};

module.exports = PaypalPayment;