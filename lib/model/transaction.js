"use strict";

var Schema = require('mongoose').Schema,
  Status = require('../status'),
  Error = require('../error'),
  uuid = require('node-uuid'),
  Paymnd = require('../index'),
  Promise = require('bluebird'),
  _extend = require('util')._extend;

var TransactionModelShema = {

  action: {
    type: String,
    enum: ['create', 'execute', 'get', 'refund', 'cancel', 'ping'],
    index: true,
    required: true
  },

  session: {},

  // is the parent and the TXN
  _payment: {
    type: Schema.Types.ObjectId,
    ref: 'Payment',
    index: true,
    required: true
  },

  // this is extern TXN Id from Vendor
  eTxn: {
    type: String,
    index: true
  },

  // write full response content from vendor callback
  response: Schema.Types.Mixed,

  // vendor status
  state: String,

  createdAt: {
    type: Date,
    default: Date.now
  }
};

var TransactionSchema = new Schema(TransactionModelShema);

/**
 * Update the Status after insert the Transaction
 */
TransactionSchema.post('save', function (doc) {
  Paymnd.Model.Payment.updateStatus(doc);
});

class TransactionModel {

  constructor(conn) {
    this.Model = conn.model('Transaction', TransactionSchema);
  }

  /**
   *
   * @returns {*}
   */
  generateTxn() {
    return uuid.v4();
  }

  /**
   *
   * @param {Object} conditions
   * @returns {Promise.<T>}
   */
  getTransactionByCondition(conditions) {
    return Promise.resolve()
      .then(() => {
        return this.findOne(conditions).populate('_payment').exec();
      });
  }

  /**
   *
   * @param {TransactionModelShema} data
   * @returns {Promise}
   */
  push(data) {
    var _transaction = new this.Model(data);

    return new Promise(function(res, rej) {
      _transaction.save(function(err) {
        if(err) {
          rej(new Error.TransactionError('Transaction save is failed', null, {error:err, paymentId:_transaction._payment}));
        } else {
          res(_transaction);
        }
      });
    });
  }

  /**
   *
   * @param {TransactionModelShema} data
   * @returns {Promise}
   */
  create(data) {
    return this.push(_extend({
      action: 'create',
      state: 'create'
    }, data));
  }

  /**
   *
   * @param {TransactionModelShema} data
   * @returns {Promise}
   */
  execute(data) {
    return this.push(_extend({
      action: 'execute',
      state: Status.PENDING
    }, data));
  }

  /**
   *
   * @param {TransactionModelShema} data
   * @returns {Promise}
   */
  cancel(data) {
    return this.push(_extend({
      action: 'cancel',
      state: Status.CANCEL
    }, data));
  }

  /**
   *
   * @param {TransactionModelShema} data
   * @returns {Promise}
   */
  refund(data) {
    return this.push(_extend({
      action: 'refund',
      state: Status.REFUND
    }, data));
  };
}

module.exports = TransactionModel;