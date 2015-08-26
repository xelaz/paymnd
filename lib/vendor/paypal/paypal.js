"use strict";

var paypal = require('paypal-rest-sdk'),
  extend = require('extend'),
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

PaypalPayment.prototype.createPayerData = function(data) {
  return {
    "payment_method": "paypal"
  }
};

/**
 *
 * @param {PaymentSchema} payment
 * @param {Object}        options
 *
 * @return {Promise}
 */
PaypalPayment.prototype.create = function(payment, options) {
  var config = Paymnd.Config;

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

  // generate internTxn for identify the payment with vendor
  var internTxn = Paymnd.Model.Transaction.Model.generateTxn();

  if(Object.hasOwnProperty.call(this.options.redirectUrl, 'approval')) {
    // approvalUrl
    paypalData.redirect_urls.return_url = url.format( {
      protocol: config.ping.url.protocol,
      host: config.ping.url.host,
      pathname: this.options.redirectUrl.approval,
      query: {
        orderId: payment.orderId,
        iTxn: internTxn
      }
    });
  }

  // cancel
  paypalData.redirect_urls.cancel_url = url.format({
    protocol: config.ping.url.protocol,
    host: config.ping.url.host,
    pathname: this.options.redirectUrl.cancel,
    query: {
      orderId: payment.orderId,
      iTxn: internTxn
    }
  });

  var successUrl = url.format({
    protocol: config.ping.url.protocol,
    host: config.ping.url.host,
    pathname: this.options.redirectUrl.success
  });

  debug('PaypalPayment.create:#payment', payment);
  debug('PaypalPayment.create:#paypalData', JSON.stringify(paypalData, null, 2));

  var create = new Promise(function(res, rej) {
    paypal.payment.create(paypalData, {}, function(err, response) {
      err && rej(err) || res(response);
    })
  });

  return create
    .then(function(resp) {
      debug('paypal.payment.create#resp:', resp);

      // TODO: Diese Zeilen Code sind nur experimentel und müssen verbessert werden
      var resData = {
        status: 'ERROR'
      };

      switch(resp.state) {
        case 'created':
          var link = resp.links;
          for (var i = 0; i < link.length; i++) {
            if (link[i].rel === 'approval_url') {
              resData.status = 'OK';
              resData.action = 'redirect';
              resData.redirectUrl = link[i].href;
            }
          }
          break;

        // kommt wenn man eine credit_card payment macht
        case 'approved':
          resData.status = 'OK';
          resData.action = 'redirect';
          resData.redirectUrl = url.format(successUrl);
          break;
      }

      debug('paypal.payment.create#resData:', resData);

      // TODO: check the parameter of right schema to avoid errors
      var transaction = new Paymnd.Model.Transaction.Model({
        txn: resp.id,
        iTxn: internTxn,
        response: resp,
        state: resp.state,
        _payment: payment._id,
        action: 'create'
      });

      return new Promise(function(res, rej) {
        transaction.save(function(err) {
          if(err) {
            rej(new Paymnd.Error.Model('Transaction save is failed', null, {error:err, paymentId:payment._id}));
          } else {
            res(resData);
          }
        });
      });
    })
    .catch(function(err) {
      return new Paymnd.Error.Transaction('Create payment failed', null, {error: err, paymentId: payment._id});
    });
};

/**
 * Send it to Paypal and write State
 * @param {Object}   data
 *
 * @return {Promise}
 */
PaypalPayment.prototype.execute = function(data) {
  debug('PaypalPayment.prototype.execute#data:', data);

  return Promise.resolve()
    .then(function() {
      if(!Object.hasOwnProperty.call(data, 'iTxn')) {
        throw callback(new Paymnd.Error.Payment('Parameter "iTxn" is not available'));
      }
    })
    .then(function() {
      return new Promise(function(res, rej) {
        Paymnd.Model.Transaction.Model.getByInternTxnId(data.iTxn, function(err, transactionPayment) {
          debug('PaypalPayment.prototype.execute#transactionPayment:', transactionPayment);

          if(err) {
            rej(new Paymnd.Error.Model('Payment execute failed', null, {error: err, iTxn: data.iTxn}));
          } else {
            res(transactionPayment);
          }
        });
      });
    })
    .then(function(transactionPayment) {
      return new Promise(function(res, rej) {
        var payer = { payer_id : data.PayerID || 0 };
        paypal.payment.execute(transactionPayment.txn, payer, {}, function (err, resp) {
          debug('paypal.payment.execute#resp:', resp);
          if(err) {
            return rej(new Paymnd.Error.Transaction('Execute Payment API call failed', null, {error: err, paymentId: paymentId}));
          }

          var paymentId = transactionPayment._payment._id;

          // TODO: Diese Zeilen Code sind nur da weil ich noch keine Lösung gemacht habe
          // eigentlich müssen sie in die Transaction verlegt werden
          var transaction = new Paymnd.Model.Transaction.Model({
            txn: resp.id,
            iTxn: transactionPayment.iTxn,
            response: resp,
            request: data,
            state: resp.state,
            _payment: paymentId,
            action: 'execute'
          });

          transaction.save(function(err) {
            if (err) return rej(new Paymnd.Error.Model('Transaction save is failed', null, {error:err, paymentId: paymentId}));
            // alles OKay
            res(transactionPayment._payment);
          });
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
  debug('PaypalPayment.prototype.refund#payment:', payment);

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

    return new Promise(function(res, rej) {
      paypal.sale.refund(result.saleId, {}, {}, function(err, resp) {
        if(err) {
          return rej(new Paymnd.Error.Transaction('Refund Payment call failed', null, {error: err, paymentId: payment._id}));
        }

        // TODO: Diese Zeilen Code sind nur da weil ich noch keine Lösung gemacht habe
        // eigentlich müssen sie in die Transaction verlegt werden
        var transaction = new Paymnd.Model.Transaction.Model({
          txn: resp.id,
          response: resp,
          state: resp.state,
          _payment: payment._id,
          action: 'refund',
          iTxn: result.iTxn
        });

        transaction.save(function(err) {
          if (err) return rej(new Paymnd.Error.Model('Transaction save is failed', null, {error:err, paymentId:payment._id}));
          // alles OKay
          res(payment);
        });
      });
    });
  });
};

/**
 * @param {Object}   data
 *
 * @return {Promise}
 */
PaymentAbstract.prototype.cancel = function(data) {

  return Promise.resolve()
    .then(function() {
      if(!Object.hasOwnProperty.call(data, 'iTxn')) {
        return callback(new Paymnd.Error.Payment('Parameter "iTxn" is not available'));
      }
    })
    .then(function() {
      return new Promise(function(res, rej) {
        Paymnd.Model.Transaction.Model.getByInternTxnId(data.iTxn, function(err, transactionPayment) {
          if(err) {
            rej(new Paymnd.Error.Transaction('Payment cancel failed', null, {error: err, iTxn: data.iTxn}));
          } else {
            res(transactionPayment);
          }
        });
      });
    })
    .then(function(transactionPayment) {
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

      return new Promise(function(res, rej) {
        transaction.save(function(err) {
          if (err) return rej(new Paymnd.Error.Model('Transaction save is failed', null, {error:err, paymentId: paymentId}));
          // alles OKay
          res(transactionPayment._payment);
        });
      });
    });
};

/**
 * Get Status info from Payment direct
 * @param {String} txn Paypal txn
 *
 * @return {Promise}
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
 * @type {action: {state: state}}
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
 * @param {Number} price
 * @return {Number}
 */
PaypalPayment.prototype.toCurrency = function(price) {
  return (price/100).toFixed(2);
};

module.exports = PaypalPayment;