exports = module.exports = function() {
  return {
    getDefault: function() {
      return exports.DEFAULT;
    },

    getEnumValues: function() {
      var stateList = [];
      Object.keys(exports).forEach(function(status) {stateList.push(exports[status])})
      return stateList;
    }
  }
}

exports.CREATE = 'create';
exports.DEBIT = 'debit';
exports.ERROR = 'error';
exports.REFUND = 'refund';
exports.PARTIAL_REFUND = 'partial_refund';
exports.PENDING = 'pending';
exports.CANCEL = 'cancel';
exports.DEFAULT = 'default';