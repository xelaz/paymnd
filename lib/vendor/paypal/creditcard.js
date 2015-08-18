"use strict";

var paypal = require('paypal-rest-sdk'),
  util = require('util'),
  PaypalPayment = require('./paypal'),
  Promise = require('bluebird');

/**
 * @param {object} options
 * @constructor
 */
var PaypalCreditCardPayment = function PaypalCreditCardPayment(options) {
  this.options = util._extend({title:'Paypal CreditCard'}, options);
  PaypalPayment.call(this, this.options);
};
util.inherits(PaypalCreditCardPayment, PaypalPayment);

PaypalCreditCardPayment.prototype.creditCardType = [
  'visa',
  'mastercard',
  'amex',
  'discover'
];

// CreditCard do not need middleware
PaypalCreditCardPayment.prototype.middleware = {};

/**
 * @param {object} data
 * @returns {{payment_method: string, funding_instruments: Array}}
 */
PaypalCreditCardPayment.prototype.createPayerData = function(data) {
  return {
    payment_method: "credit_card",
    funding_instruments: [
      {
        credit_card: {
          number: data.creditcard.number,
          type: data.creditcard.type,
          expire_month: data.creditcard.expireMonth,
          expire_year: data.creditcard.expireYear,
          cvv2: data.creditcard.cvv2,
          first_name: data.creditcard.firstName,
          last_name: data.creditcard.lastName
        }
      }
    ]
  }
};

module.exports = PaypalCreditCardPayment;