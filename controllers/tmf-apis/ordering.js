var async = require('async'),
    config = require('./../../config'),
    http = require('./../../lib/httpClient'),
    url = require('url'),
    storeClient = require('./../../lib/store').storeClient,
    utils = require('./../../lib/utils'),
    tmfUtils = require('./../../lib/tmfUtils'),
    log = require('./../../lib/logger').logger.getLogger("Root");


var ordering = (function(){

    var CUSTOMER = 'Customer';
    var SELLER = 'Seller';

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

        if (!tmfUtils.checkRole(req.user, config.oauth2.roles.admin)) {

            if (req.query['relatedPary.role'] || req.query['relatedParty.href']) {

                // This is required to control that a user can only access to those order items they are
                // involved. If this fields are allowed, the user will be able to access all the orderings
                // because filters applied to a list are independent from other filters applied to the
                // same list.
                // For example: relatedParty.id=fiware&relatedParty.role=Seller will return all the orderings
                // where there is one related party where fiware is involved or where there is a user with
                // the seller role (all).

                callback({
                    status: 403,
                    message: 'You are not allowed to filter order using this filters'
                });

            } else if (req.query['relatedParty.id'] && req.query['relatedParty.id'] !== req.user.id) {

                callback({
                    status: 403,
                    message: 'You are not authorized to retrieve the orderings made by the user ' +
                            req.query['relatedParty.id']
                });
            } else {

                // Non-admin users can only retrieve their offerings
                var separator = req.apiPath.indexOf('?') >= 0 ? '&' : '?';
                req.apiPath += separator + 'relatedParty.id=' + req.user.id;

                callback();
            }
        } else {
            // Admin users can get orderings without being filtered
            callback();
        }
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

            if (!item.product) {

                callback({
                    status: 400,
                    message: 'The product order item ' + item.id + ' must contain a product field'
                });

                return;
            }

            if (!item.productOffering) {

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
                    role: CUSTOMER,
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
                                        role: SELLER,
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

        async.series(asyncTasks, function(err/*, results*/) {

            if (err) {
                callback(err);

            } else {

                // Include sellers as related party in the ordering

                var pushedSellers = [];

                body.orderItem.forEach(function(item) {

                    var sellers = item.product.relatedParty.filter(function(party) {
                        return party.role.toLowerCase() === SELLER.toLowerCase();
                    });

                    sellers.forEach(function(seller) {

                        if (pushedSellers.indexOf(seller.id) < 0) {
                            body.relatedParty.push(seller);
                            pushedSellers.push(seller.id);
                        }

                    });
                });

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
        'PUT': [ tmfUtils.methodNotAllowed ],
        'DELETE': [ tmfUtils.methodNotAllowed ]
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

        var body = JSON.parse(req.body);

        if (req.method === 'GET' && !tmfUtils.checkRole(req.user, config.oauth2.roles.admin)) {

            // Elements from the list are only filtered when the user is not the admin of the application!

            var orderings = [];
            var isArray = true;

            if (!Array.isArray(body)) {
                orderings = [body];
                isArray = false;
            } else {
                orderings = body;
            }

            orderings.forEach(function(ordering) {

                var customer = false;
                var seller = false;

                ordering.relatedParty.forEach(function(party) {

                    if (party.id === req.user.id) {

                        switch (party.role.toLowerCase()){
                            case CUSTOMER.toLowerCase():
                                customer = true;
                                break;
                            case SELLER.toLowerCase():
                                seller = true;
                                break;
                        }
                    }
                });

                if (!customer && !seller) {
                    // Not supposed to happen
                    ordering.orderItem = [];
                } else if (!customer && seller) {

                    // When a user is involved only as a seller in an ordering, only the order items
                    // where the user is a seller have to be returned

                    ordering.orderItem = ordering.orderItem.filter(function(item) {
                        return item.product.relatedParty.some(function(party) {
                            return party.role.toLowerCase() === SELLER.toLowerCase() && party.id === req.user.id;
                        });
                    });
                }
                // ELSE: If the user is the customer, order items don't have to be filtered

            });

            if (!isArray) {
                req.body = JSON.stringify(orderings[0]);
            } else {
                req.body = JSON.stringify(orderings);
            }

            // If the body is modified, the content-length header has to be modified
            req.headers['content-length'] = Buffer.byteLength(req.body);

            callback();

        } else if (req.method === 'POST') {

            // Send ordering notification to the store
            log.info('Executing Ordering post validation');
            storeClient.notifyOrder(body, req.user, function(err, res) {

                if(res) {

                    var parsedResp = JSON.parse(res.body);

                    if (parsedResp.redirectUrl) {
                        req.headers['X-Redirect-URL'] = parsedResp.redirectUrl;
                    }

                    callback();

                } else {

                    callback(err);
                }
            });
        } else {
            callback();
        }
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };
})();

exports.ordering = ordering;