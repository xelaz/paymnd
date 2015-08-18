"use strict";

process.env.NODE_CONFIG_DIR = __dirname + '/config';
process.on('uncaughtException', function(err) {
  console.error('SERVER UncaughtException\n',  err.stack || err);
});

var config = require('config');

if (config.debug.verbose) {
  process.env.DEBUG_VERBOSE = true; // sagt nur aus ob er eingeschaltet wurde oder nicht
  process.env.DEBUG = config.debug.level;
  process.env.DEBUG_COLORS = true;
}

var
  // First CALL must initialize payme
  // Init with Options
  Paymnd = require('../index')(config.paymnd);

var http = require('http'),
  debug = require('debug')('paymnd:app'),
  express = require('express'),
  routes = require('./routes'),
  session = require('express-session'),
  path = require('path'),
  flash = require('connect-flash'),
  models = require('./models'),
  bodyParser = require('body-parser'),
  morgan = require('morgan'),
  cookieParser = require('cookie-parser'),
  errorHandler = require('errorhandler');

// Or some cases if you want in other location setup it after require
// var Paymnd = require('../index');
// ...

//Paymnd.Error.Payment();;
debug('RegisterdVendors: %s', Paymnd.Vendor.getVendorKeys());
debug('RegisterdPayments: %s', Paymnd.Vendor.getMethodKeys());
debug('Payment Paypal: %s', JSON.stringify(Paymnd.Vendor.getByMethod('paypal'), false, 2));


//var test = require('./test');

//Paymnd.Vendor.getPayment('cc').api.create();

/*Paymnd.Model.Transaction.getTxnByOrderId('0912a040-5c0e-11e3-a7a6-59b3014c7812', function(err, docs) {
  console.log('#', err, docs);
});
*/

//console.log('###', Paymnd.Vendor.getMethod('paypal').convertStateToStatus('created', 'create'));


/**
 * Events wenn sich ein Payment ändert
 *
 * Payment trigert Event wenn sich ein Payment ändert,
 * somit kann man drauf reagieren und dementsprechend die
 * Bestellung anpassen
 */

var Order = require('./models').Order;
Paymnd.Model.Payment.Event.on('statusChanged', function(payment) {
  console.log('####statusChanged', payment);
});

Paymnd.Model.Payment.Event.on('statusDebited', function(payment) {
  Order.findOne({orderId: payment.orderId}, function(err, doc) {
    if(err || !doc) return;

    doc.status = 'debit';
    doc.save();
  });
  console.log('####statusDebited', payment);
});

Paymnd.Model.Payment.Event.on('statusRefunded', function(payment) {
  Order.findOne({orderId: payment.orderId}, function(err, doc) {
    if(err) return;

    doc.status = 'refund';
    doc.save();
  });
  console.log('####statusRefunded', payment);
});



var app = express();

app.set('template_engine', 'jade');
app.set('domain', config.server.server);
app.set('port', config.server.port || 3000);
app.set('views', __dirname + '/view');
app.set('view engine', 'jade');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.set('trust proxy', 1); // trust first proxy
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'abracadabra',
  resave: false,
  saveUninitialized: true
}));
app.use(flash());

app.use(morgan('combined'));
app.use(errorHandler({
  log: true
}));
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
 * use Paymnd as express middleware
 */

/**
 * init full standalone app with Payment pings
 * without your express infrastructure and nesting
 */
//Paymnd.Middleware.setup();

/**
 * init full standalone app with Payment pings
 * without your express infrastructure and nesting
 */
Paymnd.Middleware.setup(app);

/**
 * or init only ping middleware if you have your own express app infrastructure
 * and nested your app
 */
//app.use(Paymnd.Middleware.setup(app).getApp());

//require('./test');

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
