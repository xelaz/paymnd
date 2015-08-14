"use strict";

var paypal = require('paypal-rest-sdk'),
  extend = require('extend'),
  debug = require('debug')('payme:vendor:paypal'),
  util = require('util'),
  PaypalPayment = require('./paypal'),
  Status = require('../../status'),
  url = require('url');

/**
 * @param {object} options
 * @constructor
 */
var PaypalCreditCardPayment = function PaypalCreditCardPayment(options) {
  this.options = util._extend({title:'Paypal CreditCard'}, options);
  PaypalPayment.call(this, this.options);
};
util.inherits(PaypalCreditCardPayment, PaypalPayment);


// CreditCard do not need middleware
PaypalCreditCardPayment.prototype.middleware = {};

/**
 * @param {object} data
 * @returns {{payment_method: string, funding_instruments: Array}}
 */
PaypalCreditCardPayment.prototype.createPayerData = function(data) {
  return {
    "payment_method": "credit_card",
    "funding_instruments": [
      {
        "credit_card": {
          "number": data.creditcard.number,
          "type": data.creditcard.type,
          "expire_month": data.creditcard.expireMonth,
          "expire_year": data.creditcard.expireYear,
          "cvv2": data.creditcard.cvv2,
          "first_name": data.creditcard.firstName,
          "last_name": data.creditcard.lastName
        }
      }
    ]
  }
};

PaypalCreditCardPayment.prototype.creditCardType = ['visa', 'mastercard', 'amex', 'discover'];

module.exports = PaypalCreditCardPayment;