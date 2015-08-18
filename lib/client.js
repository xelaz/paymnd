'use strict';

var http = require('http'),
  https = require('https'),
  util = require('util'),
  url = require('url');

function Client(options, configs) {}

/**
 *
 * @param {Object} urlObj urlObj
 * @param {Function} callback
 */
Client.prototype.request = function (method, urlObj, data, callback) {
  var client = (urlObj['protocol'] === 'http:') ? http : https;

  if(typeof data === 'function') {
    callback = data;
  }

  var req = client.request(url.format(urlObj));

  req.on('error', function (e) {
    // TODO: add logger
    callback(e.message);
  });

  req.on('response', function (res) {
    var _data = [];

    res.setEncoding('utf8');

    res.on('data', function (chunk) {
      _data.push(chunk);
    });

    res.on('end', function () {
      var err = null,
          response = _data.join('');

      //console.log('content-type', res.headers['content-type']);

      try {
        if (res.headers['content-type'] === "application/json") {
          response = JSON.parse(response);
        }
      } catch (e) {
        err = new Error('Invalid JSON Response Received');
        err.error = {
          name: 'Invalid JSON Response Received, JSON Parse Error'
        };
        err.response = response;
        err.httpStatusCode = res.statusCode;
        response = null;
      }

      if (!err && (res.statusCode < 200 || res.statusCode >= 300) ) {
        err = new Error('Response Status : ' + res.statusCode);
        err.response = response;
        err.httpStatusCode = res.statusCode;
        response = null;
      }

      callback(err, response);
    });
  });

  req.end();
};

module.exports = Client;