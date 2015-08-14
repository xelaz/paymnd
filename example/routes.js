var config = {},
  PayMe = require('../index'),
  async = require('async'),
  mongoose = PayMe.Model.Resource,
  uuid = require('node-uuid');

exports.index = function (req, res) {
  res.locals.session = req.session;
  var flash = req.flash('info');
  var messages = flash.length > 0 ? flash[0].message : null;
  res.render('index', {messages: messages});
};

exports.order = function (req, res) {
  res.locals.session = req.session;
  var Order = mongoose.model('Order');

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
    // results is now equal to ['one', 'two']
    if(!err) {
      req.flash('info', { message : [{desc: "Ihr produkt wurde erfolgreich in den Warenkorb gelegt", type: "info"}]});
    } else {
      //console.log(err);
      req.flash('info', { message : [{desc: err, type: "danger"}]});
    }

    res.redirect('/');
  });
};

exports.checkoutBefore = function(req, res, next) {
  var Order = mongoose.model('Order');

  if(!req.session.order) {
    req.flash('info', { message : [{desc: 'Ihr Warenkorb ist leer', type: "danger"}]});
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
      res.locals.payments = PayMe.Vendor.getMethodTitles();
      next(err);
    });
};

exports.checkoutGet = function (req, res) {
  console.log('Get:');
  res.render('checkout');
};

exports.checkoutPost = function(req, res) {
  //var Order = mongoose.model('Payment');
  var order = res.locals.order;
  console.log('Checkout POST');

  // preise müssen an das payment in cent werten übergeben werden
  var amount = order.amount * 100;

  // Das ist der Api aufruf
  PayMe.Vendor.paymentCreate(
  {
    orderId: order.orderId,
    amount: amount, // total price
    // Übergabe der Payment Methode, im Example kommt es als POST param
    method: req.body.payment
  },
  {
    order: {
      description: 'Test Bestellung',
      itemList: [{
        quantity: 1,
        name: 'Eier',
        price: amount, // muss ein Integer sein von Typ Number
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
      lastName: 'Tester',
      ip: '62.157.236.170' // User IP is needed
    }
  },
  function(err, resData) { // Callback nach dem das Payment ausgeführt wurde
    if(err) {
      console.log('ERR:', JSON.stringify(err, null, 2));
      req.flash('info', { message : [{desc: 'Bei der Bestellung sind Fehler aufgetretten.', type: "danger"}]});
      res.redirect('/');
      return;
    }

    if(resData.status == 'OK' && resData.action == 'redirect') {
      delete req.session.order;
      res.redirect(resData.redirectUrl);
      return;
    } else if(resData.status == 'ERROR') {
      req.flash('info', { message : [{desc: 'Die Bestellung konnte nicht Ordnungsgemäß abgewikelt werden.', type: "warning"}]});
      res.redirect('/');
      return;
    } else {
      res.render('checkout');
    }
  });
};

exports.successGet = function (req, res) {
  console.log('successGet:', req.query);
  res.render('success');
};

exports.cancelGet = function (req, res) {
  console.log('cancelGet:', req.query);
  res.render('cancel');
};

exports.errorGet = function (req, res) {
  console.log('Error:', req.query);
  res.render('error');
};

// diese Methode zeigt wie man selber ein Execute ausführen kann
exports.paymentExecuteGet = function (req, res) {
  console.log('paymentExecuteGet:', req.query);

  PayMe.Vendor.paymentExecute(req.query,
    {},
    function(err, resData) {
      res.end();
    });
};

exports.overviewGet = function (req, res) {
 var Order = mongoose.model('Order'),
    Payment = PayMe.Model.Payment.Model;

  async.waterfall([
    function(callback){
      Order.find({}, null, {sort: {createdAt: -1}}, function(err, orders) {
        callback(err, orders);
      });
    },
    function(orders, callback) {
      var newOrders = [];
      async.each(orders, function(order, cb) {
        Payment.getByOrderId(order.orderId, function(err, payment) {
          if(payment) {
            newOrders.push({
              order: order,
              payment: payment
            });
          }
          cb(err);
        });
      }, function(err) {
        callback(err, newOrders);
      });
    }
  ], function (err, result) {
    //console.log('Res:', result);
    res.render('overview', {orders: result});
  });
};

exports.refundGet = function (req, res) {
  console.log('refundGet:', req.query);

  PayMe.Vendor.paymentRefund({orderId:req.query.orderId},{}, function(err) {
    if(err) {
      console.log(err);
      req.flash('info', { message : [{desc: 'Beim stornieren ist es zu einem Fehler gekommen - ' + err, type: "danger"}]});
      res.redirect('/');
    } else {
      req.flash('info', { message : [{desc: 'Gut storniert', type: "success"}]});
      res.redirect('/');
    }
  });
};

exports.init = function(c) {
  config = c;
};