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
});

/**
 *  * @param {Error} error
 */
ErrorSchema.static('log', function(error) {
  try {
    var model = new this;

    model.stack = error.stack || undefined;
    model.name = error.name || undefined;
    model.message = error.message || undefined;
    model.code = error.code || undefined;
    model.params = error.params || undefined;

    if(error.params.error) {

      var err = {};
      var prop = Object.getOwnPropertyNames(error.params.error);
      for (var k in prop) { err[prop[k]] = error.params.error[prop[k]]; }

      model.params.error = err;
    }

    model.save();
  } catch(e) {} // dry
});

module.exports = function(connection) {
  module.exports.Model = connection.model('Error', ErrorSchema);
};

module.exports.Schema = ErrorSchema;