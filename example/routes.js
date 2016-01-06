var Paymnd = require('../'),
  async = require('async'),
  mongoose = Paymnd.Model.Connection,
  uuid = require('node-uuid'),
  Promise = require('bluebird');

exports.index = function (req, res) {
  res.render('index');
};

exports.order = function (req, res) {
  res.locals.session = req.session;
  var Order = mongoose.model('Order');

  console.log('Order: ', req.query);

  async.waterfall([
    function(callback){
      // create order object
      if(!req.session.order) {
        var newOrderId = uuid.v1();

        var nOrder = new Order({
          orderId: newOrderId,
          amount: req.query.amount,
          offerId: req.query.offer
        });
        nOrder.save(function(err, doc) {
          if(!err) {
            req.session.order = newOrderId;
          }

          callback(err, doc);
        });
      } else {
        // update order
        Order.findOne({ orderId: req.session.order}, function(err, doc) {

          if(err || !doc) {
            callback(err);
          }

          doc.amount = req.query.amount;
          doc.offerId = req.query.offer;

          doc.save(function(err) {
            err && callback(err) || callback(null, doc);
          });
        });
      }
    }
  ],
  // optional callback
  function(err){
    if(!err) {
      console.log('ORDER SUCCESS');
      req.flash('info', { message : [{desc: "Product was successfully added to cart", type: "info"}]});
    } else {
      console.log('ERRR:', err);
      req.flash('info', { message : [{desc: err, type: "danger"}]});
    }

    res.redirect('/');
  });
};

exports.checkoutBefore = function(req, res, next) {
  var Order = mongoose.model('Order');

  if(!req.session.order) {
    req.flash('info', { message : [{desc: 'Your cart is empty', type: "danger"}]});
    return res.redirect('/');
  }

  async.waterfall([
    function(callback){
      Order.findOne({ orderId: req.session.order}, function(err, doc) {
        callback(err, doc);
      });
    }
  ],
    function(err, order) {
      res.locals.order = order;
      res.locals.payments = Paymnd.Vendor.getMethodTitles();
      next(err);
    });
};

exports.checkoutGet = function (req, res) {
  res.render('checkout');
};

exports.checkoutPost = function(req, res) {
  //var Order = mongoose.model('Payment')
  var order = res.locals.order;

  // preise müssen an das payment in cent werten übergeben werden
  var amount = order.amount * 100;

  Paymnd.Vendor.paymentCreate({
    orderId: order.orderId,
    amount: amount, // total price
    // vendor method name
    method: req.body.payment
  },{
    order: {
      description: 'Test Order',
      itemList: [{
        quantity: 1,
        name: 'Test Product',
        price: amount, // integer
        currency: 'EUR' // optional, when nicht gesetzt mach die Vendor Method Paypal es automatisch
      }]
    },
    creditcard: {
      number: req.body.ccNumber,
      cvv2: req.body.ccCvv2,
      type: req.body.ccType,
      expireYear: req.body.ccExpireYear,
      expireMonth: req.body.ccExpireMonth,
      firstName: 'Tester',
      lastName: 'Test'
    },
    customer: {
      id: 4234567894, // User Id is needed
      firstName: 'Alexander',
      lastName: 'Xander',
      ip: '62.157.236.170' // User IP is needed
    }
  })
    .catch(function(err) {
      console.error('ERR:', JSON.stringify(err, null, 2));
      req.flash('info', { message : [{desc: 'Error on create payment', type: "warning"}]});
      res.redirect('/checkout');
    })
    .then(function(result) {
      if(result.status == 'OK' && result.redirect) {
        // redirect to the next payment step
        res.redirect(result.redirect);
      } else {
        req.flash('info', { message : [{desc: 'Payment create successful', type: "success"}]});
        res.redirect('/success');
      }
    });
};

exports.successGet = function (req, res) {
  delete req.session.order;
  res.render('success');
};

exports.cancelGet = function (req, res) {
  res.render('cancel');
};

exports.errorGet = function (req, res) {
  res.render('error');
};

// diese Methode zeigt wie man selber ein Execute ausführen kann
exports.executeGet = function (req, res, next) {
  Paymnd.Vendor.paymentExecute(req.query.orderId)
    .then(function() {
    "use strict";
    res.redirect('/overview');
  }).catch(next);
};

exports.overviewGet = function (req, res) {
  var Order = mongoose.model('Order'),
    Payment = Paymnd.Model.Payment;

  new Promise(function(res, rej) {
    Order.find({}, null, {sort: {createdAt: -1}}, function(err, orders) {
        err ? rej(err) : res(orders);
      });
    })
    .then(function(orders) {
      var newOrders = [];

      return Promise.all(orders.map(function(order) {
        return Payment.getByOrderId(order.orderId)
          .then((payment) => {
            newOrders.push({
              order: order,
              payment: payment
            });
          }).catch((err) => {
            console.log('Error: ', err.stack);
          });
      })).then(function() {
        return newOrders;
      });
    })
    .then(function(result) {
      res.render('overview', {orders: result});
    }).catch(function(result) {
      res.render('overview', {orders: []});
    });
};

exports.refundGet = function (req, res) {

  Paymnd.Vendor.paymentRefund(req.query.orderId)
    .then(function() {
      req.flash('info', { message : [{desc: 'Refund succesful', type: "success"}]});
      res.redirect('/overview');
    })
    .catch(function(err) {
      console.log('REFUND ERROR: ', err, err.stack);
      req.flash('info', { message : [{desc: 'Error on refund - ' + err, type: "danger"}]});
      res.redirect('/overview');
    });
};

exports.cancelPaymentGet = function (req, res) {

  Paymnd.Vendor.paymentCancel(req.query.orderId)
    .then(function() {
      req.flash('info', { message : [{desc: 'Cancel succesful', type: "success"}]});
      res.redirect('/overview');
    })
    .catch(function(err) {
      console.log('REFUND ERROR: ', err, err.stack);
      req.flash('info', { message : [{desc: 'Error on cancel - ' + err, type: "danger"}]});
      res.redirect('/overview');
    });
};
