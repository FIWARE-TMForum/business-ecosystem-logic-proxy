var async = require('async'),
    config = require('./../../config'),
    http = require('./../../lib/httpClient'),
    url = require('url'),
    storeClient = require('./../../lib/store').storeClient,
    utils = require('./../../lib/utils'),
    tmfUtils = require('./../../lib/tmfUtils'),
    log = require('./../../lib/logger').logger.getLogger("Root");


var ordering = (function(){

    var isOrderingCustomer = function(userInfo, resourceInfo) {
        var isCust = false;
        var custIncluded = false;

        for (var i = 0; i < resourceInfo.relatedParty.length && !isCust; i++) {
            var party = resourceInfo.relatedParty[i];

            if (party.role.toLowerCase() === 'customer') {
                custIncluded = true;
                if (userInfo.id === party.id) {
                    isCust = true;
                }
            }
        }
        return [custIncluded, isCust];
    };

    var validateRetrieving = function(req, callback) {
        callback();
    };

    var validateCreation = function(req, callback) {
        var body;

        // The request body may not be well formed
        try {
            body = JSON.parse(req.body);
        } catch (e) {

            callback({
                status: 400,
                message: 'The resource is not a valid JSON document'
            });

            return; // EXIT
        }

        // Check that the related party field has been included
        if (!body.relatedParty) {

            callback({
                status: 400,
                message: 'A product order must contain a relatedParty field'
            });

            return;
        }

        // Check that the user has the customer role or is an admin
        if (!tmfUtils.checkRole(req.user, config.oauth2.roles.admin)
                && !tmfUtils.checkRole(req.user, config.oauth2.roles.customer)) {

            callback({
                status: 403,
                message: 'You are not authorized to order products'
            });

            return; // EXIT
        }

        // Check that the user is the specified customer
        var customerCheck = isOrderingCustomer(req.user, body);
        if (!customerCheck[0]) {
            callback({
                status: 403,
                message: 'It is required to specify a customer in the relatedParty field'
            });

            return; // EXIT
        }

        if (!customerCheck[1]) {
            callback({
                status: 403,
                message: 'The customer specified in the product order is not the user making the request'
            });

            return; // EXIT
        }

        if (!body.orderItem) {
            callback({
                status: 400,
                message: 'A product order must contain an orderItem field'
            });

            return;
        }

        // Inject the related party customer in the order items in order to make this info
        // available thought the inventory API
        for (var i = 0; i < body.orderItem.length; i++) {
            if(!body.orderItem[i].product) {
                callback({
                    status: 400,
                    message: 'The product order item ' + body.orderItem[i].id + ' must contain a product field'
                });
            }

            if (!body.orderItem[i].product.relatedParty) {
                body.orderItem[i].product.relatedParty = [];
            }
            var itemCustCheck = isOrderingCustomer(req.user, body.orderItem[i].product);

            if (itemCustCheck[0] && !itemCustCheck[1]) {
                callback({
                    status: 403,
                    message: 'The customer specified in the order item ' + body.orderItem[i].id + ' is not the user making the request'
                });
                return;
            }

            if (!itemCustCheck[0]) {
                body.orderItem[i].product.relatedParty.push({
                    id: req.user.id,
                    role: 'Customer',
                    href: ''
                });
            }
        }

        req.body = JSON.stringify(body);
        callback();
    };

    var validateUpdate = function(req, callback) {
        callback({
            status: 501,
            message: 'The update of product orders is not yet supported'
        })
    };

    var validators = {
        'GET': [ tmfUtils.validateLoggedIn, validateRetrieving ],
        'POST': [ tmfUtils.validateLoggedIn, validateCreation ],
        'PATCH': [ tmfUtils.validateLoggedIn, validateUpdate ],
        'PUT': [ tmfUtils.validateLoggedIn, validateUpdate ],
        'DELETE': [ tmfUtils.validateLoggedIn, validateUpdate ]
    };

    var checkPermissions = function (req, callback) {
        log.info('Checking Ordering permissions');

        var reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        async.series(reqValidators, callback);
    };

    var executePostValidation = function(req, callback) {
        if (req.method === 'POST') {
            // Send ordering notification to the store
            log.info('Executing Ordering post validation');
            storeClient.notifyOrder(JSON.parse(req.body), req.user, function(err, res) {

                if(res) {

                    var parsedResp = JSON.parse(res.body);

                    res.extraHdrs = {
                        'X-Redirect-URL': parsedResp.redirectUrl
                    };

                    callback(null, res);

                } else {

                    callback(err, res);
                }
            });
        } else {
            callback(null, {
                extraHdrs: {}
            });
        }
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };
})();

exports.ordering = ordering;