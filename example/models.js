var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  Paymnd = require('../index');

var OrderSchema = {
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

module.exports.Order = Paymnd.Model.Resource.model('Order', new Schema(OrderSchema));