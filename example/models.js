var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  PayMe = require('../index');

var OrderSchema = {
  orderId: String,

  amount: Number,

  offerId: Number,

  status: {
    type: String,
    enum: PayMe.Status().getEnumValues(),
    default: PayMe.Status().getDefault()
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
};

module.exports.Order = PayMe.Model.Resource.model('Order', new Schema(OrderSchema));