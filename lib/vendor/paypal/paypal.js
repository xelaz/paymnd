"use strict";

var paypal = require('paypal-rest-sdk'),
  extend = require('extend'),
  debug = require('debug')('payme:vendor:paypal'),
  util = require('util'),
  PaymentAbstract = require('../payment'),
  PayMe = require('../..'),
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
    var payment = this;

    this.execute(req.query, {}, function(err, data) {
      if(err) {
        res.redirect(url.resolve('/', payment.getVendor().options.redirectUrl.error) + '?orderId=' + req.query.orderId || 0);
      } else {
        res.redirect(url.resolve('/', payment.getVendor().options.redirectUrl.success)  + '?orderId=' + req.query.orderId || 0);
      }
    });
  },

  cancel: function(req, res) {
    var payment = this;

    this.cancel(req.query, {}, function(err) {
      if(err) {
        res.redirect(url.resolve('/', payment.getVendor().options.redirectUrl.error) + '?orderId=' + req.query.orderId || 0);
      } else {
        res.redirect(url.resolve('/', payment.getVendor().options.redirectUrl.cancel) + '?orderId=' + req.query.orderId || 0);
      }
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
 * @param {Object}        option
 * @param {Function}      callback
 */
PaypalPayment.prototype.create = function(payment, option, callback) {
  var config = PayMe.Config;

  var paypalData = {
    "intent": "sale",
    "payer": this.createPayerData(option),
    "redirect_urls": {},
    "transactions": [{
      "amount": {
        "currency": this.options.currency,
        "total": this.toCurrency(payment.amount),
        details: {
          //tax: 1.99   // steuer anteil
        }
      },
      "description": option.order.description,
      "item_list": {
        items: this.prepareItem(option.order.itemList)
      }
    }]
  };

  // generiere eine InterneTXN von der aus man später die PaypalTXN rausfindet
  var internTxn = PayMe.Model.Transaction.Model.generateTxn();

  if(Object.hasOwnProperty.call(this.options.redirectUrl, 'approval')) {
    var approvalUrl = {
      protocol: config.server.protocol,
      host: config.server.host,
      pathname: this.options.redirectUrl.approval,
      query: {
        orderId: payment.orderId,
        iTxn: internTxn
      }
    };
    paypalData.redirect_urls.return_url = url.format(approvalUrl);
  }

  var cancelUrl = url.format({
    protocol: config.server.protocol,
    host: config.server.host,
    pathname: this.options.redirectUrl.cancel,
    query: {
      orderId: payment.orderId,
      iTxn: internTxn
    }
  });
  paypalData.redirect_urls.cancel_url = cancelUrl;

  var successUrl = url.format({
    protocol: config.server.protocol,
    host: config.server.host,
    pathname: this.options.redirectUrl.success
  });

  debug('PaypalPayment.create:#payment', payment);
  debug('PaypalPayment.create:#paypalData', JSON.stringify(paypalData, null, 2));

  paypal.payment.create(paypalData, {}, function(err, resp) {
    debug('paypal.payment.create#resp:', resp);

    if (err) {
      return callback(new PayMe.Error.Transaction('Create Payment failed', null, {error: err, paymentId: payment._id}));
    }

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

    // TODO: check the parameter of right schema to avoid errors
    var transaction = new PayMe.Model.Transaction.Model({
      txn: resp.id,
      iTxn: internTxn,
      request: resp,
      state: resp.state,
      _payment: payment._id,
      action: 'create'
    });

    debug('paypal.payment.create#resData:', resData);

    transaction.save(function(err) {
      if (err) return callback(new PayMe.Error.Model('Transaction save is failed', null, {error:err, paymentId:payment._id}));
      // alles OKay
      callback(null, resData);
    });
  });
};

/**
 * Send it to Paypal and write State
 * @param {Object}   data
 * @param {Object}   option
 * @param {Function} callback
 */
PaypalPayment.prototype.execute = function(data, option, callback) {
  debug('PaypalPayment.prototype.execute#data:', data);

  if(!Object.hasOwnProperty.call(data, 'iTxn')) {
    return callback(new PayMe.Error.Payment('Parameter "iTxn" is not available'));
  }

  PayMe.Model.Transaction.Model.getByInternTxnId(data.iTxn, function(err, transactionPayment) {
    debug('PaypalPayment.prototype.execute#transactionPayment:', transactionPayment);

    if(err) {
      return callback(new PayMe.Error.Model('Payment execute failed', null, {error: err, iTxn: data.iTxn}));
    }

    var payer = { payer_id : data.PayerID || 0 };
    paypal.payment.execute(transactionPayment.txn, payer, {}, function (err, resp) {
      debug('paypal.payment.execute#resp:', resp);

      var paymentId = transactionPayment._payment._id;

      if(err) {
        return callback(new PayMe.Error.Transaction('Execute Payment API call failed', null, {error: err, paymentId: paymentId}));
      }

      // TODO: Diese Zeilen Code sind nur da weil ich noch keine Lösung gemacht habe
      // eigentlich müssen sie in die Transaction verlegt werden
      var transaction = new PayMe.Model.Transaction.Model({
        txn: resp.id,
        iTxn: transactionPayment.iTxn,
        request: resp,
        state: resp.state,
        _payment: paymentId,
        action: 'execute'
      });

      transaction.save(function(err) {
        if (err) return callback(new PayMe.Error.Model('Transaction save is failed', null, {error:err, paymentId: paymentId}));
        // alles OKay
        callback(null);
      });
    });
  });
};

/**
 *
 * @param {PaymentSchema} payment
 * @param {Object}        option
 * @param {Function}      callback
 */
PaypalPayment.prototype.refund = function(payment, option, callback) {
  debug('PaypalPayment.prototype.refund#payment:', payment);

  PayMe.Model.Transaction.Model.getPaypalSaleId(payment._id, function(err, saleId) {
    if(err) {
      return callback(err);
    }

    paypal.sale.refund(saleId, {}, {}, function(err, resp) {
      if(err) {
        // TODO Log Error to DB
        return callback(new PayMe.Error.Transaction('Refund Payment call failed', null, {error: err, paymentId: payment._id}));
      }

      // TODO: Diese Zeilen Code sind nur da weil ich noch keine Lösung gemacht habe
      // eigentlich müssen sie in die Transaction verlegt werden
      var transaction = new PayMe.Model.Transaction.Model({
        txn: resp.id,
        request: resp,
        state: resp.state,
        _payment: payment._id,
        action: 'refund'
      });

      transaction.save(function(err) {
        if (err) return callback(new PayMe.Error.Model('Transaction save is failed', null, {error:err, paymentId:payment._id}));
        // alles OKay
        callback(null);
      });
    });
  });
};

/**
 * Get Status info from Payment direct
 * @param {PaymentSchema} payment
 * @param {Object}        options
 * @param {Function}      callback
 */
PaypalPayment.prototype.get = function(payment, options, callback) {
  paypal.payment.get('PAY-730156128F2420001KKQ442A', {}, function(err, resp) {
    if(err) {
      return callback(err);
    }

    callback(null, resp);
  });

/*  paypal.sale.get('07756242LH553763R', {}, function(err, resp) {
   if(err) {
    return callback(err);
   }

    callback(null, resp);
   });*/
};

/**
 *
 * @param {Object}   data
 * @param {Object}   options
 * @param {Function} callback
 */
PaypalPayment.prototype.cancel = function(data, options, callback) {
  if(!Object.hasOwnProperty.call(data, 'iTxn')) {
    return callback(new PayMe.Error.Payment('Parameter "iTxn" is not available'));
  }

  PayMe.Model.Transaction.Model.getByInternTxnId(data.iTxn, function(err, transactionPayment) {
    if(err) {
      return callback(new PayMe.Error.Transaction('Payment cancel failed', null, {error: err, iTxn: data.iTxn}));
    }

    var paymentId = transactionPayment._payment._id;

    // TODO: Diese Zeilen Code sind nur da weil ich noch keine Lösung gemacht habe
    // eigentlich müssen sie in die Transaction verlegt werden
    var transaction = new PayMe.Model.Transaction.Model({
      txn: transactionPayment.txn,
      state: 'canceled',
      _payment: paymentId,
      action: 'cancel'
    });

    transaction.save(function(err) {
      if (err) return callback(new PayMe.Error.Model('Transaction save is failed', null, {error:err, paymentId:paymentId}));
      // alles OKay
      callback(null);
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
    'canceled': Status.CANCEL
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