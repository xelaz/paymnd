"use strict";

var Paymnd = require('../');

// init config
var config = require('config');

describe('PaymndModel ', function() {

  it('should have Errors', function() {

    var PaymndPromise = Paymnd(config.paymnd);

    return PaymndPromise.then(function() {
      console.log('INITIALIZED');
      console.log('Paymnd', Paymnd.Vendor.getVendorKeys);
    });

    //Paymnd.Model.Payment.
  });

});