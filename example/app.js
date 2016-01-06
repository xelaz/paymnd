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
  // Load Paymnd
  Paymnd = require('../');

var http = require('http'),
  debug = require('debug')('paymnd:app'),
  express = require('express'),
  session = require('express-session'),
  FileStore = require('session-file-store')(session),
  path = require('path'),
  flash = require('connect-flash'),
  bodyParser = require('body-parser'),
  morgan = require('morgan'),
  cookieParser = require('cookie-parser'),
  errorHandler = require('errorhandler');

// Or some cases if you want in other location setup it after require
// var Paymnd = require('../');
// ...

/**
 * Events wenn sich ein Payment ändert
 *
 * Payment trigert Event wenn sich ein Payment ändert,
 * somit kann man drauf reagieren und dementsprechend die
 * Bestellung anpassen
 */

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
  store: new FileStore({
    path: __dirname + '/session'
  }),
  secret: 'abracadabra',
  resave: false,
  saveUninitialized: true
}));
app.use(flash());


app.use(function (req, res, next) {
  res.locals.session = req.session;
  var flash = req.flash('info');
  res.locals.messages = flash.length > 0 ? flash[0].message : null;
  next();
});

app.use(morgan('combined'));
app.use(errorHandler({
  log: true
}));
app.locals.inspect = require('util').inspect;


Paymnd(config.paymnd).then(function() {
  var routes = require('./routes'),
    models = require('./models'),
    Order = require('./models').Order;


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
  app.get('/execute', routes.executeGet);
  app.get('/cancel-payment', routes.cancelPaymentGet);

//Paymnd.Error.PaymentError();;
  debug('RegisterdVendors: %s', Paymnd.Vendor.getVendorKeys());
   debug('RegisterdPayments: %s', Paymnd.Vendor.getMethodKeys());
   debug('Payment Paypal: %s', JSON.stringify(Paymnd.Vendor.getByMethod('paypal'), false, 2));
   debug('Payment PaypalObject: %o', Paymnd.Vendor.getByMethod('paypal'));


  Paymnd.Model.Payment.getEvent().on('changed', function(payment) {
    console.log('####statusChanged', payment);
  });

  Paymnd.Model.Payment.getEvent().on('debit', function(payment) {

    Order.findOne({orderId: payment.orderId}, function(err, doc) {
      if(err || !doc) return;

      doc.status = 'debit';
      doc.save(function(err) {
        err && console.log('ERROR onsave: ', err.stack);
        console.log('####status: ', payment);
      });
    });
  });

  Paymnd.Model.Payment.getEvent().on('cancel', function(payment) {
    Order.findOne({orderId: payment.orderId}, function(err, doc) {
      if(err || !doc) return;

      doc.status = 'cancel';
      doc.save(function(err) {
        err && console.log('ERROR onsave: ', err.stack);
        console.log('####status: ', payment);
      });
    });
  });

  Paymnd.Model.Payment.getEvent().on('refund', function(payment) {
    Order.findOne({orderId: payment.orderId}, function(err, doc) {
      if(err) return;

      doc.status = 'refund';
      doc.save(function(err) {
        err && console.log('ERROR onsave: ', err.stack);
        console.log('####status: ', payment);
      });
    });
  });


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
}).catch(function(err) {
  console.log('PAYMND ERROR:', err.stack);
});

