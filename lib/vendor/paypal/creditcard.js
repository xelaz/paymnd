"use strict";

var PaypalPayment = require('./paypal');

/**
 * @param {object} options
 * @constructor
 */
class PaypalCreditCardPayment extends PaypalPayment {

  constructor(options) {
    super(options);

    this.creditCardType = [
      'visa',
      'mastercard',
      'amex',
      'discover'
    ];

    this.middleware = {};
  }

  /**
   * @param {object} data
   * @returns {{payment_method: string, funding_instruments: Array}}
   */
  createPayerData(data) {
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
  }
}

module.exports = PaypalCreditCardPayment;