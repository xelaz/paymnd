"use strict";

var Status = require('../status'),
  Promise = require('bluebird'),
  Paymnd = require('../index');

class PaymentAbstract {

  constructor(options) {
    // overwrite name with type if exists
    this.methodName = options.methodName;
    this.options = options;

    /**
     * @type {action: {state: state}}
     */
    this.state = {};

    /**
     * @type {Vendor}
     */
    this.vendor = null;

    /**
     * Middleware bind automaticaly the Payment Scope.
     *
     * Middleware can be as Function:
     *
     * and used as GET / POST
     *
     *
     * function(req, res, next) {
     *  console.log('MiddleWare is not implemented')
     * }
     *
     * Or as Object with own Get and Post Function
     *
     * {
     *  get: function(req, res, next) {
     *    ...
     *  },
     *
     *  post: function(req, res, next) {
     *    ...
     *  }
     *
     *  execute: function(req, res, next)
     *
     *  mynameofaction: function(req, res, next)
     *
     *  .....
     * }
     *
     */
    this.middleware = {
      get: function (req, res) {
        // this is only example and not be in use
        res.end();
      },

      post: function (req, res) {
        // this is only example and not be in use
        res.end();
      }
    };

    this.init();
  }

  /**
   * This Function can use as initialization
   */
  init() {
    // empty
  }

  /**
   * @returns {String}
   */
  getCurrency() {
    return this.options.currency;
  }

  /**
   * Get Short Title
   *
   * @returns {String}
   */
  getTitle() {
    return this.options.title;
  }

  /**
   *  Get Short Method Type if it's extra defined
   *
   * @returns {String}
   */
  getMethodName() {
    return this.methodName;
  }

  /**
   * @returns {Vendor}
   */
  getVendor() {
    return this.vendor;
  }

  /**
   *
   * @param {Vendor} vendor
   * @return {PaymentAbstract}
   */
  setVendor(vendor) {
    this.vendor = vendor;
    return this;
  }

  getMiddleware() {
    return this.middleware;
  };

  /**
   *
   * @param {string} middlewareAction
   *
   * @returns {string}
   */
  getMiddlewarePath(middlewareAction) {
    return Paymnd.Middleware.getMiddlewarePath(this, middlewareAction);
  };

  /**
   * @returns {Object}
   */
  getConfig() {
    return Paymnd.Config;
  }

  /**
   * Get Payment Details from Vendor
   *
   * @abstract
   * @param payment
   * @param {Function, Object} options Option can be Optional
   * @param callback
   */
  get(payment, options, callback) {
    console.log('This Function is not implemented');
  };

  /**
   * Create Payment and send it to Vendor
   *
   * @abstract
   *
   * @param {PaymentSchema}    payment
   * @param {Object}           [options] Option can be Optional
   *
   * @return {Promise}
   */
  create(payment, options) {
    return Promise.reject(new Error('Function create is not implemented'));
  }

  /**
   * Execute Payment
   *
   * @abstract
   * @param {PaymentSchema}    payment
   *
   * @return {Promise}
   */
  execute(payment) {
    return Promise.reject(new Error('Function execute is not implemented'));
  }

  /**
   * Refund Paymaent
   *
   * @abstract
   * @param {PaymentSchema} payment
   *
   * @return {Promise}
   */
  refund(payment) {
    return Promise.reject(new Error('Function refund is not implemented'));
  }

  /**
   * Refund Paymaent
   *
   * @abstract
   *
   * @param {PaymentSchema} payment
   *
   * @return {Promise}
   */
  cancel(payment) {
    return Promise.reject(new Error('Function cancel is not implemented'));
  }


  /**
   * Get payment status
   *
   * @param {String} state
   * @param {String} action
   *
   * @return {String}
   */
  convertStateToStatus(state, action) {
    if (action && this.state.hasOwnProperty(action) && this.state[action].hasOwnProperty(state)) {
      return this.state[action][state];
    } else if (this.state.hasOwnProperty(state)) {
      return this.state[state];
    } else {
      return Status().getDefault();
    }
  };

  /**
   * Convert Price to needed Format for Vendor
   *
   * @public
   * @param {Number} price
   * @return {Number}
   */
  toCurrency(price) {
    return price;
  };
}

module.exports = PaymentAbstract;