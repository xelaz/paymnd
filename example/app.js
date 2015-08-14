"use strict";

process.env.NODE_CONFIG_DIR = __dirname + '/config';

var config = require('config');

if (config.debug.verbose) {
  process.env.DEBUG_VERBOSE = true; // sagt nur aus ob er eingeschaltet wurde oder nicht
  process.env.DEBUG = config.debug.level;
  process.env.DEBUG_COLORS = true;
}

//var payment = require('./payment');

var
  // First CALL must initialize payme
  // Init with Options
  PayMe = require('../index')(config.payme);

var http = require('http'),
  debug = require('debug')('payme:app'),
  express = require('express'),
  routes = require('./routes'),
  session = require('express-session'),
  path = require('path'),
  flash = require('connect-flash'),
  models = require('./models'),
  bodyParser = require('body-parser'),
  cookieParser = require('cookie-parser'),
  errorHandler = require('errorhandler');

// Or some cases if you want in other location setup it after require
// var PayMe = require('../index');
// ...

//PayMe.Error.Payment();;
debug('RegisterdVendors: %s', PayMe.Vendor.getVendorKeys());
debug('RegisterdPayments: %s', PayMe.Vendor.getMethodKeys());
debug('Vendor: %s', JSON.stringify(PayMe.Vendor.getVendor('micropayment'), false, 2));
debug('Payment Paypal: %s', JSON.stringify(PayMe.Vendor.getMethod('paypal'), false, 2));
debug('Payment CreditCard: %s', JSON.stringify(PayMe.Vendor.getMethod('cc'), false, 2));
debug('Payment Debit: %s', JSON.stringify(PayMe.Vendor.getMethod('db'), false, 2));

//console.log(PayMe.Vendor.getVendor('micropayment').getName());
/*debug('AppPayment1: %s', PayMe.Vendor.getVendor('micropayment').get('creditcard').getName());
console.log(PayMe.Vendor.getVendor('paypal').get('paypal').getName());
console.log(PayMe.Vendor.getVendor('micropayment').get('lastschrift').getName());

console.log('Type:');
console.log(PayMe.Vendor.getVendor('micropayment').get('creditcard').getType());
console.log(PayMe.Vendor.getVendor('paypal').get('paypal').getType());
console.log(PayMe.Vendor.getVendor('micropayment').get('lastschrift').getType());

console.log('Title:');
console.log(PayMe.Vendor.getVendor('micropayment').get('creditcard').getTitle());
console.log(PayMe.Vendor.getVendor('paypal').get('paypal').getTitle());
console.log(PayMe.Vendor.getVendor('micropayment').get('lastschrift').getTitle());*/

//var test = require('./test');

//PayMe.Vendor.getPayment('cc').api.create();

/*PayMe.Model.Transaction.getTxnByOrderId('0912a040-5c0e-11e3-a7a6-59b3014c7812', function(err, docs) {
  console.log('#', err, docs);
});
*/

//console.log('###', PayMe.Vendor.getMethod('paypal').convertStateToStatus('created', 'create'));


/**
 * Events wenn sich ein Payment ändert
 *
 * Payment trigert Event wenn sich ein Payment ändert,
 * somit kann man drauf reagieren und dementsprechend die
 * Bestellung anpassen
 */

var Order = require('./models').Order;
PayMe.Model.Payment.Event.on('statusChanged', function(payment) {
  console.log('####statusChanged', payment);
});

PayMe.Model.Payment.Event.on('statusDebited', function(payment) {
  Order.findOne({orderId: payment.orderId}, function(err, doc) {
    if(err || !doc) return;

    doc.status = 'debit';
    doc.save();
  });
  console.log('####statusDebited', payment);
});

PayMe.Model.Payment.Event.on('statusRefunded', function(payment) {
  Order.findOne({orderId: payment.orderId}, function(err, doc) {
    if(err) return;

    doc.status = 'refund';
    doc.save();
  });
  console.log('####statusRefunded', payment);
});

// experiment
/*PayMe.Vendor.getMethod('paypal').get({txn: '1KM7948389791834B'}, {}, function(err, res) {
  console.log('#', err, JSON.stringify(res, null, 2));
});*/


var app = express();

routes.init(config);


app.set('template_engine', 'jade');
app.set('domain', config.server.host);
app.set('port', config.server.port || 3000);
app.set('views', __dirname + '/view');
app.set('view engine', 'jade');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.set('trust proxy', 1); // trust first proxy
app.use(session({
  secret: 'abracadabra',
  resave: true,
  saveUninitialized: true,
  cookie: { secure: true }
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(flash());

app.use(errorHandler());
app.locals.inspect = require('util').inspect;


app.get('/', routes.index);
app.get('/order', routes.order);
app.all('/checkout', routes.checkoutBefore);
app.get('/checkout', routes.checkoutGet);
app.post('/checkout', routes.checkoutPost);

app.get('/success', routes.successGet);
app.get('/cancel', routes.cancelGet);
app.get('/error', routes.errorGet);
app.get('/overview', routes.overviewGet);
app.get('/refund', routes.refundGet);

/**
 * use PayMe as express middleware
 */

/**
 * init full standalone app with Payment pings
 * without your express infrastructure and nesting
 */
//PayMe.Middleware.setup();

/**
 * init full standalone app with Payment pings
 * without your express infrastructure and nesting
 */
PayMe.Middleware.setup(app);

/**
 * or init only ping middleware if you have your own express app infrastructure
 * and nested your app
 */
//app.use(PayMe.Middleware.setup(app).getApp());

//require('./test');

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
