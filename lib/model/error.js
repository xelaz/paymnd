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
    var err = this.parse(error);
    var model = new this.Model(err);

    if(error && error.params && error.params.error) {
      model.params = {error: this.parse(error.params.error)};
    }

    return new Promise((res, rej) => {
      model.save(function(err) {
        err ? rej(err) : res(true);
      });
    }).catch(function() { return null });
  }

  parse(err) {
    return JSON.parse(JSON.stringify(err || {}, ['message', 'name', 'stack', 'code']));
  }
}

module.exports = ErrorModel;