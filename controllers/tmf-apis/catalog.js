var async = require('async'),
    config = require('./../../config'),
    http = require('./../../lib/httpClient'),
    storeClient = require('./../../lib/store').storeClient,
    url = require('url'),
    utils = require('./../../lib/utils'),
    tmfUtils = require('./../../lib/tmfUtils'),
    log = require('./../../lib/logger').logger.getLogger('Root');

var LIFE_CYCLE = 'lifecycleStatus';

var ACTIVE_STATE = 'active';
var LAUNCHED_STATE = 'launched';


// Validator to check user permissions for accessing TMForum resources
var catalog = (function() {

    var retrieveAsset = function(assetPath, errMsg, callback) {

        var options = {
            host: config.appHost,
            port: config.endpoints.catalog.port,
            path: assetPath,
            method: 'GET',
            headers: {'accept': 'application/json'}
        };

        var protocol = config.appSsl ? 'https' : 'http';

        http.request(protocol, options, null, function(err, result) {
            if (err) {

                callback({
                    status: 400,
                    message: errMsg
                })
            } else {
                callback(null, result);
            }
        });

    };

    // Retrieves the product belonging to a given offering
    var retrieveProduct = function(offeringInfo, callback) {

        var productUrl = offeringInfo.productSpecification.href;
        var productPath = url.parse(productUrl).pathname;
        var errMsg = 'The product specification of the given product offering is not valid';

        retrieveAsset(productPath, errMsg, callback);
    };

    var checkAssetStatusByBody = function(assetBody, validStates) {

        return validStates.indexOf(assetBody[LIFE_CYCLE].toLowerCase()) >= 0;
    };

    // Retrieves an asset and che
    var checkAssetStatusByPath = function(assetPath, validStates, callback) {

        retrieveAsset(assetPath, 'The asset cannot be retrieved', function(err, result) {

            if (err) {

                callback(err);

            } else {

                var assetInfo = JSON.parse(result.body);
                callback(null, checkAssetStatusByBody(assetInfo, validStates));
            }

        });
    };

    // The request is directly allowed without extra validation required
    var validateAllowed = function(req, callback) {
        callback();
    };

    var catalogPathFromOfferingUrl = function(offeringUrl) {
        var productOfferingPos = offeringUrl.indexOf('/productOffering');
        return url.parse(offeringUrl.substring(0, productOfferingPos)).pathname;
    };

    var createHandler = function(userInfo, resp, callback) {
        if (tmfUtils.isOwner(userInfo, resp)) {
            callback();
        } else {
            callback({
                status: 403,
                message: 'The user making the request and the specified owner are not the same user'
            });
        }
    };

    var validateOfferingCreation = function(user, offeringBody, catalogPath, callback) {

        var validStates = [ACTIVE_STATE, LAUNCHED_STATE];

        // Check that the catalog attached to the offering is active or launched
        checkAssetStatusByPath(catalogPath, validStates, function(err, result) {

            if (err) {
                callback({
                    status: 400,
                    message: 'The catalog attached to the offering cannot be read'
                });
            } else {

                if (result === true) {

                    // Check that the product attached to the offering is owned by
                    // the same user
                    retrieveProduct(offeringBody, function (err, result) {

                        if (err) {
                            callback(err);
                        } else {

                            var product = JSON.parse(result.body);

                            if (checkAssetStatusByBody(product, validStates)) {
                                createHandler(user, product, callback);
                            } else {
                                callback({
                                    status: 400,
                                    message: 'Offerings can only be attached to active or launched products'
                                });
                            }
                        }
                    });

                } else {
                    callback({
                        status: 400,
                        message: 'Offerings can only be created in a catalog that are active or launched'
                    });
                }

            }
        });
    };

    // Validate the creation of a resource
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

        // Check that the user has the seller role or is an admin
        if (!tmfUtils.checkRole(req.user, config.oauth2.roles.seller) && !
                tmfUtils.checkRole(req.user, config.oauth2.roles.admin)) {
            callback({
                status: 403,
                message: 'You are not authorized to create resources'
            });

            return; // EXIT
        }

        if (req.url.indexOf('productOffering') > -1) {

            var catalogPath = catalogPathFromOfferingUrl(req.url);
            validateOfferingCreation(req.user, body, catalogPath, callback);

        } else if (req.url.indexOf('productSpecification') > -1) {
            // Check that the product specification contains a valid product
            // according to the charging backed
            storeClient.validateProduct(body, req.user, function(err) {
               if (err) {
                   callback(err);
               } else {
                   createHandler(req.user, body, callback);
               }
            });
        } else {
            createHandler(req.user, body, callback);
        }
    };

    var updateHandler = function(userInfo, resp, callback) {
        if (tmfUtils.isOwner(userInfo, resp)) {
            callback();
        } else {
            callback({
                status: 403,
                message: 'The user making the request is not the owner of the accessed resource'
            });
        }
    };

    // Validate the modification of a resource
    var validateUpdate = function(req, callback) {

        var options = {
            host: config.appHost,
            port: config.endpoints.catalog.port,
            path: req.url,
            method: 'GET',
            headers: {'accept': 'application/json'}
        };

        var protocol = config.appSsl ? 'https' : 'http';

        // Retrieve the resource to be updated or removed
        http.request(protocol, options, '', function (err, result) {
            if (err) {

                callback({
                    status: err.status,
                    message: err.body
                });

            } else {

                var parsedResp = JSON.parse(result.body);

                // Check if the request is an offering
                if (req.url.indexOf('productOffering') > -1) {
                    retrieveProduct(parsedResp, function(err, result) {
                        if (err) {
                            callback(err, result);
                        } else {
                            updateHandler(req.user, JSON.parse(result.body), callback);
                        }
                    });
                } else {
                    updateHandler(req.user, parsedResp, callback);
                }
            }
        });
    };

    var validateOfferingCycle = function(req, callback) {

        var pattern = new RegExp('/catalog/\\d+/productOffering/\\d+');

        if (pattern.exec(req.url)) {

            // Check life cycle just for offerings

            try {

                var body = JSON.parse(req.body);

                if (LIFE_CYCLE in body && body[LIFE_CYCLE].toLowerCase() == LAUNCHED_STATE) {

                    var offeringPath = url.parse(req.url).pathname;

                    retrieveAsset(offeringPath, 'The offering cannot be retrieved', function(err, result) {

                        if (err) {

                            callback(err, result);

                        } else {

                            var productPath = JSON.parse(result.body).productSpecification.href;

                            // Check the catalog life cycle only when the offering life cycle is being updated

                            var productOfferingPos = req.url.indexOf('/productOffering/');
                            var catalogPath  = url.parse(req.url.substring(0, productOfferingPos)).pathname;

                            var tasks = [];
                            tasks.push(checkAssetStatusByPath.bind(this, catalogPath, [LAUNCHED_STATE]));
                            tasks.push(checkAssetStatusByPath.bind(this, productPath, [LAUNCHED_STATE]));

                            async.parallel(tasks, function(err, results) {

                                if (err) {

                                    callback({
                                        status: 400,
                                        message: 'The product and/or the catalog attached to the offering ' +
                                                'cannot be checked'
                                    });

                                } else {

                                    var valid = true;
                                    for (var i = 0; i < results.length && valid; i++) {
                                        valid = results[i];
                                    }

                                    if (valid) {

                                        // The correct case: attached product and catalog are launched!
                                        callback();
                                    } else {

                                        callback({
                                            status: 400,
                                            message: 'Offerings can only be launched when the associated catalog ' +
                                                    'and/or product are launched'
                                        });
                                    }
                                }
                            });
                        }
                    });

                } else {
                    callback();
                }

            } catch (e) {
                callback({
                    status: 400,
                    message: 'The resource is not a valid JSON document'
                });
            }

        } else {
            callback();
        }

    };

    var validators = {
        'GET': [ validateAllowed ],
        'POST': [ tmfUtils.validateLoggedIn, validateCreation ],
        'PATCH': [ tmfUtils.validateLoggedIn, validateUpdate, validateOfferingCycle ],
        'PUT': [ tmfUtils.validateLoggedIn, validateUpdate, validateOfferingCycle ],
        'DELETE': [ tmfUtils.validateLoggedIn, validateUpdate ]
    };

    var checkPermissions = function (req, callback) {
        log.info('Checking Catalog permissions');

        var reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        async.series(reqValidators, callback);
    };

    return {
        checkPermissions: checkPermissions
    };

})();

exports.catalog = catalog;
