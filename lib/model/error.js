"use strict";

var Schema = require('mongoose').Schema,
  util = require('util');

/**
 * @typedef {ErrorSchema}
 */
var ErrorSchema = new Schema({

  stack: String,

  name: String,

  message: String,

  code: Number,

  params: Schema.Types.Mixed,

  createdAt: {
    type: Date,
    default: Date.now
  }
},{
  collection: 'paymnd_error'
});

class ErrorModel {

  constructor(conn) {
    this.Model = conn.model('Error', ErrorSchema);
  }

  log(error) {
    var model = new this.Model;

    model.stack = error.stack || undefined;
    model.name = error.name || undefined;
    model.message = error.message || undefined;
    model.code = error.code || undefined;
    model.params = error.params || undefined;

    if(error.params && error.params.error) {
      var err = {};
      var prop = Object.getOwnPropertyNames(error.params.error);
      for (var k in prop) { err[prop[k]] = error.params.error[prop[k]]; }

      model.params.error = err;
    }

    return new Promise((res, rej) => {
      model.save(function(err) {
        err ? rej(err) : res(true);
      });
    }).catch(function() { return null });
  }
}

module.exports = ErrorModel;