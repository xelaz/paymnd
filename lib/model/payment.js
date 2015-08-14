"use strict";

var Status = require('../status'),
  Error = require('../error'),
  Schema = require('mongoose').Schema,
  PayMe = require('../'),
  events = require('events'),
  util = require("util");

var PaymentSchema = new Schema({

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

  // wenn nicht gesetzt dann wird das default genommen
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
  }
});

PaymentSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.statusHistory.push(this.status);
  }
  next();
});

PaymentSchema.static('getByOrderId', function (orderId, callback) {
  this.findOne({orderId : orderId}, function (err, payment) {
    if (err) {
      callback(new Error.Model(err));
    } else {
      callback(null, payment);
    }
  });
});

/**
 * Change Status on state change and fire onChange Event
 *
 * @param {TransactionSchema} transaction
 * @param {Function} callback
 */
PaymentSchema.static('updateStatus', function (transaction, callback) {
  this.findOne({_id : transaction._payment}, function (err, payment) {
    if (err) {
      callback(new Error.Model(err));
    } else if(payment) {
      var newStatus = PayMe.Vendor
        .getVendor(payment.vendor)
        .get(payment.method)
        .convertStateToStatus(transaction.state, transaction.action);

      if(!newStatus) {
        payment.status = Status().getDefault();
      } else {
        payment.status = newStatus;
      }

      payment.save(function(err) {
        if(err) return callback(err);

        // global trigger
        Event.statusChanged(payment);

        // targeted trigger
        switch(payment.status) {
          case Status.CREATE:
            Event.statusCreated(payment);
            break;
          case Status.DEBIT:
            Event.statusDebited(payment);
            break;
          case Status.REFUND:
            Event.statusRefunded(payment);
            break;
          case Status.PARTIAL_REFUND:
            Event.statusPartialRefunded(payment);
            break;
          case Status.ERROR:
            Event.statusError(payment);
            break;
          case Status.CANCEL:
            Event.statusCanceled(payment);
            break;
          case Status.PENDING:
            Event.statusPending(payment);
            break;
        }
      });
    }
  });
});

var PaymentEvent = function() {
  events.EventEmitter.call(this);
};
util.inherits(PaymentEvent, events.EventEmitter);


PaymentEvent.prototype.statusChanged = function(payment) {
  this.emit('statusChanged', payment);
}

PaymentEvent.prototype.statusCreated = function(payment) {
  this.emit('statusCreated', payment);
}

PaymentEvent.prototype.statusDebited = function(payment) {
  this.emit('statusDebited', payment);
}

PaymentEvent.prototype.statusRefunded = function(payment) {
  this.emit('statusRefunded', payment);
}

PaymentEvent.prototype.statusPartialRefunded = function(payment) {
  this.emit('statusPartialRefunded', payment);
}

PaymentEvent.prototype.statusCanceled = function(payment) {
  this.emit('statusCanceled', payment);
}

PaymentEvent.prototype.statusError = function(payment) {
  this.emit('statusError', payment);
}

PaymentEvent.prototype.statusPending = function(payment) {
  this.emit('statusPending', payment);
}

var Event = new PaymentEvent;


module.exports = function(mongoose) {
  // init
  exports.Model = mongoose.model('Payment', PaymentSchema);
};

exports.Schema = PaymentSchema;
exports.Event = Event;