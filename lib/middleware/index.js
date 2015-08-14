"use strict";

var debug = require('debug')('payme:middleware'),
  PayMe = require('../');


module.exports = function(config) {
  var app;

  /**
   * Generiert middleware mit folgenden routings
   *
   * get /[config.ping.path]/vendor/method/action
   *
   * Falls vendor und method gleich sind
   * get /[config.ping.path]/method/action
   *
   * Das [config.ping.path] ist ein Prefix und
   * kann beliebig in der Config angepasst werden
   */
  function init() {
    debug('Init Middleware');

    PayMe.Vendor.getMethodKeys().forEach(function(key) {
      var payment = PayMe.Vendor.getMethod(key);

      var vendorName = payment.getVendor().getName(),
        methodName = payment.getName();

      var route = [config.ping.path, vendorName];

      // if paymentName equal as vendorName then use only vendorName
      if(vendorName != methodName) {
        route.push(methodName);
      }

      var middleware = payment.getMiddleware();

      debug('Init Payment Method: %s', methodName);

      if(middleware !== null) switch(typeof middleware) {
        case 'function':
          app.all(route.join('/'), middleware.bind(payment));
          debug('Single Path: %s', route.join('/'));
          break;

        case 'object':
          var methods = Object.keys(middleware);

          // spitt all methods
          methods.forEach(function(method) {
            switch(method) {
              case 'get':
                debug('Single Path GET: %s', route.join('/'));
                app.get(route.join('/'), middleware.get.bind(payment));
                break;
              case 'post':
                debug('Single Path POST: %s', route.join('/'));
                app.post(route.join('/'), middleware.post.bind(payment));
                break;
              default:
                debug('Splitted Path: %s', route.concat(method).join('/'));
                app.get(route.concat(method).join('/'), middleware[method].bind(payment));
            }
          });

          break;
      }
    });
  }

  return {

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
    }
  }
};