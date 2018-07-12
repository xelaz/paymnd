const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Paymnd = require('../lib/index');

const OrderSchema = {
  orderId: String,

  amount: Number,

  offerId: Number,

  status: {
    type: String,
    enum: Paymnd.Status().getEnumValues(),
    default: Paymnd.Status().getDefault()
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
};

module.exports.Order = Paymnd.Model.Connection.model('Order', new Schema(OrderSchema));
