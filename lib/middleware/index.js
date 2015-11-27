"use strict";

var debug = require('debug')('paymnd:middleware'),
  Paymnd = require('../'),
  url = require('url');


module.exports = function(config) {
  var app;


  var helper = {

    /**
     * @param exp
     * @returns {*}
     */
    setup: function(exp) {
      this.setApp(exp);
      init();
      return this;
    },

    /**
     * @param exp
     * @returns {*}
     */
    setApp: function(exp) {
      if(!exp) {
        throw new Error('Express not available');
      }
      app = exp;

      return this;
    },

    /**
     * @returns {*}
     */
    getApp: function() {
      return app;
    },

    /**
     *
     * @param {PaymentAbstract} payment
     * @param {string} [middlewareAction]
     *
     * @returns {string}
     */
    getMiddlewarePath: function(payment, middlewareAction) {
      var vendorName = payment.getVendor().getName(),
        methodName = payment.getMethod();

      var route = [
        config.ping.url.pathname,
        vendorName
      ];

      // if paymentName equal as vendorName then use only vendorName
      if(vendorName !== methodName) {
        route.push(methodName);
      }

      if(middlewareAction) {
        route.push(middlewareAction);
      }

      return url.resolve('/', route.join('/'));
    }
  };

  /**
   * Create middleware actions
   *
   * get /[config.ping.url.pathname]/[vendor]/[methodName]/action
   *
   * if vendor and methodName equals
   * get /[config.ping.url.pathname]/[methodName]/method/action
   *
   */
  function init() {
    debug('Init Middleware');

    Paymnd.Vendor.getMethodKeys().forEach(function(key) {
      var payment = Paymnd.Vendor.getByMethod(key);
      var middleware = payment.getMiddleware();

      debug('Init Payment Method: %s', payment.getMethod());

      if(middleware !== null) switch(typeof middleware) {
        case 'function':
          app.all(helper.getMiddlewarePath(payment), middleware.bind(payment));
          debug('Single Path: %s', helper.getMiddlewarePath(payment));
          break;

        case 'object':
          var methods = Object.keys(middleware);

          // spitt all methods
          methods.forEach(function(method) {
            switch(method) {

              case 'get':
                debug('Single Path GET: %s', helper.getMiddlewarePath(payment));
                app.get(route.join('/'), middleware.get.bind(payment));
                break;

              case 'post':
                debug('Single Path POST: %s', helper.getMiddlewarePath(payment));
                app.post(route.join('/'), middleware.post.bind(payment));
                break;

              default:
                debug('Splitted Path: %s', helper.getMiddlewarePath(payment, method));
                app.get(helper.getMiddlewarePath(payment, method), middleware[method].bind(payment));
            }
          });

          break;
      }
    });
  }

  return helper;
};