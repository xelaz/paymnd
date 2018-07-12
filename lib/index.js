'use strict';

const Promise = require('bluebird');

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
    .then(() => Paymnd.Model(config))
    .then(() => Paymnd.Vendor.load(config));
};