"use strict";

var Status = require('../status'),
  Error = require('../error'),
  Schema = require('mongoose').Schema,
  Paymnd = require('../'),
  events = require('events'),
  util = require("util"),
  Promise = require('bluebird'),
  debug = require('debug')('paymnd:model:payment');

var PaymentModelSchema = {

  orderId: {
    type: String,
    required: true,
    index: true
  },

  amount: {
    type: Number,
    required: true,

    // convert string|object|array|NaN|undefined to number or 0
    set: function(num) {
      return num|0;
    }
  },

  // on emty set default currency from config
  currency: String,

  vendor: {
    type: String,
    required: true
  },

  method: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: Status().getEnumValues(),
    default: Status.CREATE
  },

  statusHistory: [],

  createdAt: {
    type: Date,
    default: Date.now
  },

  modified: {
    type: Date,
    default: Date.now
  },

  //for additional data if you need storage some specials
  data: {
    type: Schema.Types.Mixed
  }
};

var PaymentSchema = new Schema(PaymentModelSchema);

PaymentSchema.pre('save', function (next) {
  if (this.isModified('status') || this.isNew) {
    this.statusHistory.push(this.status);
  }
  this.modified = new Date();
  next();
});

class PaymentEvent extends events.EventEmitter {
  constructor() {
    super();
  }
}

class PaymentModel {

  constructor(conn) {
    this.Event = new PaymentEvent();
    this.Model = conn.model('Payment', PaymentSchema);
  }

  /**
   *
   * @param {Object} paymentData
   * @returns {Promise.<PaymentModelSchema|Error>}
   */
  create(paymentData) {
    debug('PaymentModel.create(paymentData: %o)', paymentData);
    return new Promise((res, rej) => {
      this.Model.create(paymentData, function(err, payment) {
        debug('paymentCreate#createPayment: orderId %s', paymentData.orderId);
        err ? rej(err) : res(payment);
      });
    });
  }

  /**
   * Return the last Payment that was create with orderId
   *
   * @param {String} orderId
   * @returns {Promise.<PaymentModelSchema>}
   */
  getByOrderId(orderId) {
    debug('PaymentModel.getByOrderId(orderId: %s)', orderId);
    return Promise
      .resolve()
      .then(() => {
        return this.Model.findOne({orderId : {$eq: orderId}}).sort({ _id: -1 }).exec();
      })
      .then((payment) => {
        debug('PaymentModel.getByOrderId().then(payment: %o)', payment);
        if(payment) {
          return payment;
        }

        throw new Error.PaymentError('Get Payment by order id "' + orderId + '" was not found');
      });
  }

  /**
   *
   * @param {Object} id
   * @returns {Promise.<T>}
   */
  getById(id) {
    return Promise.resolve()
      .then(() => {
        return this.Model.findOne({_id : {$eq: id}}).exec();
      })
      .then((payment) => {
        if(payment) {
          return payment;
        }

        throw new Error.PaymentError('Get Payment by id "' + id + '" was not found');
      });
  }

  /**
   * Change Status on state change and fire onChange Event
   *
   * @param {TransactionSchema} transaction
   */
  updateStatus(transaction) {
    debug('PaymentModel.updateStatus(transaction: %o)', transaction);
    return Promise
      .resolve()
      .then(() => {
        return this.getById(transaction._payment);
      })
      .then((payment) => {
        debug('PaymentModel.updateStatus().then(payment: %o)', payment);
        payment.status = Paymnd.Vendor
          .getByMethod(payment.method)
          .convertStateToStatus(transaction.state, transaction.action);

        return new Promise((res, rej) => {
          payment.save(function(err) {
            err ? rej(err) : res(payment);
          });
        });
      })
      .then((payment) => {
        // global trigger
        this.Event.emit('changed', payment);
        this.Event.emit(payment.status, payment);
        return payment;
      });
  }

  /**
   *
   * @returns {PaymentEvent|*}
   */
  getEvent() {
    return this.Event;
  }
}

module.exports = PaymentModel;