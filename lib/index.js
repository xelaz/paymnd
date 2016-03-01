'use strict';

var Promise = require('bluebird');

/**
 *
 * @param config
 * @returns {Promise}
 */
module.exports = function Paymnd(config) {

  return Promise.resolve()
    .then(() => {
      Paymnd.Config = Object.assign({}, config);
      Paymnd.Status = require('./status');
      Paymnd.Error = require('./error');
      Paymnd.Model = require('./model');
      Paymnd.Vendor = require('./vendor');
      Paymnd.Middleware = require('./middleware')(config);
    })
    .then(() => {
      return Paymnd.Model(config);
    })
    .then(() => {
      return Paymnd.Vendor.load(config);
    });
};