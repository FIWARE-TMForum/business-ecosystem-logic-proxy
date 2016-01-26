var async = require('async'),
    config = require('./../../config'),
    http = require('./../../lib/httpClient'),
    url = require('url'),
    storeClient = require('./../../lib/store').storeClient,
    utils = require('./../../lib/utils'),
    tmfUtils = require('./../../lib/tmfUtils'),
    log = require('./../../lib/logger').logger.getLogger("Root");


var ordering = (function(){

    var makeRequest = function(rawUrl, errMsg, callback) {

        var parsedUrl = url.parse(rawUrl);

        var options = {
            host: parsedUrl.hostname,
            port: parsedUrl.port || 80,
            path: parsedUrl.path,
            method: 'GET'
        };

        var protocol = parsedUrl.protocol.indexOf('https') >= 0 ? 'https' : 'http';

        http.request(protocol, options, null, function(err, result) {

            if (err) {
                callback({
                    status: 400,
                    message: errMsg
                });
            } else {
                callback(err, JSON.parse(result.body));
            }
        });
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
        var customerCheck = tmfUtils.isOrderingCustomer(req.user, body);
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

        var completeRelatedPartyInfo = function(item, callback) {

            if(!item.product) {

                callback({
                    status: 400,
                    message: 'The product order item ' + item.id + ' must contain a product field'
                });

                return;
            }

            if(!item.productOffering) {

                callback({
                    status: 400,
                    message: 'The product order item ' + item.id + ' must contain a productOffering field'
                });

                return;
            }

            if (!item.product.relatedParty) {
                item.product.relatedParty = [];
            }
            var itemCustCheck = tmfUtils.isOrderingCustomer(req.user, item.product);

            if (itemCustCheck[0] && !itemCustCheck[1]) {
                callback({
                    status: 403,
                    message: 'The customer specified in the order item ' + item.id + ' is not the user making the request'
                });
                return;
            }

            if (!itemCustCheck[0]) {
                item.product.relatedParty.push({
                    id: req.user.id,
                    role: 'Customer',
                    href: ''
                });
            }

            // Inject customer and seller related parties in the order items in order to make this info
            // available thought the inventory API

            var errorMessageOffer = 'The system fails to retrieve the offering attached to the ordering item ' + item.id;
            var errorMessageProduct = 'The system fails to retrieve the product attached to the ordering item ' + item.id;

            makeRequest(item.productOffering.href, errorMessageOffer, function(err, offering) {

                if (err) {
                    callback(err);
                } else {

                    makeRequest(offering.productSpecification.href, errorMessageProduct, function(err, product) {

                        if (err) {
                            callback(err);
                        } else {

                            var owners = product.relatedParty.filter(function (relatedParty) {
                                return relatedParty['role'].toLowerCase() === 'owner';
                            });

                            if (!owners) {
                                callback({
                                    status: 400,
                                    message: 'You cannot order a product without owners'
                                });

                            } else {
                                owners.forEach(function (owner) {
                                    item.product.relatedParty.push({
                                        id: owner.id,
                                        role: 'Seller',
                                        href: ''
                                    });
                                });

                                callback(null, item);
                            }
                        }
                    });

                }
            });
        };

        var asyncTasks = [];

        body.orderItem.forEach(function(item) {
           asyncTasks.push(completeRelatedPartyInfo.bind(this, item));
        });

        async.series(asyncTasks, function(err, results) {

            if (err) {
                callback(err);

            } else {

                // This part only makes sense when the completeRelatedPartyInfo function
                // does not modify the item but create a new one...

                // body.orderItem = [];

                // results.forEach(function(item) {
                //     body.orderItem.push(item);
                // });

                req.body = JSON.stringify(body);

                callback();

            }
        });
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

                    if (parsedResp.redirectUrl) {
                        res.extraHdrs = {
                            'X-Redirect-URL': parsedResp.redirectUrl
                        };
                    }

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