# Payment Server #
 
Paymnd is express microservice to implement external payment services.

## Requirement ##
- mongo
- express
- node >= 4.0.0

## Supported payment services ##
- Paypal
- Saferpay
- SEPA (local)

## Run Example ##

1. `npm install --dev`
2. create `local.yaml` in /example/config
3. `npm run pm2` or `node example/app.js

## TODO: ##
- Paypal IPN