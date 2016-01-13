"use strict";

var Promise = require('bluebird');

/**
 *
 * @param config
 * @returns {Promise}
 */
module.exports = function paymnd(config) {

  paymnd.Config = Object.assign({}, config);
  paymnd.Status = require('./status');
  paymnd.Error = require('./error');
  paymnd.Model = require('./model');
  paymnd.Vendor = require('./vendor');
  paymnd.Middleware = require('./middleware')(config);

  return Promise.resolve()
    .then(function() {
      return paymnd.Model(config);
    })
    .then(() => {
      return paymnd.Vendor.load(config);
    });
};