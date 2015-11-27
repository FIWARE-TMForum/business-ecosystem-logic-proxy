var async = require('async'),
    config = require('./../../config'),
    http = require('./../../lib/httpClient'),
    storeClient = require('./../../lib/store').storeClient,
    url = require('url'),
    utils = require('./../../lib/utils'),
    log = require('./../../lib/logger').logger.getLogger("Root");

// Validator to check user permissions for accessing TMForum resources
var catalog = (function() {

    // Check whether the owner role is included in the info field
    var isOwner = function (userInfo, info) {
        var status = false;
        if (checkRole(userInfo, config.oauth2.roles.admin)) {
            status = true;
        } else if (info.relatedParty) {
            var parties = info.relatedParty;

            for(var i = 0; !status && i < parties.length; i++) {
                var party = parties[i];

                if (party.role.toLowerCase() == 'owner' && party.id == userInfo.id) {
                    status = true
                }
            }
        }

        return status;
    };

    var checkRole = function (userInfo, role) {
        var valid = false;

        // Search for provider role
        for (var i = 0; i < userInfo.roles.length && !valid; i++) {
            if (userInfo.roles[i].name.toLowerCase() === role.toLowerCase()) {
                valid = true;
            }
        }

        return valid;
    };

    // Retrieves the product belonging to a given offering
    var retrieveProduct = function(userInfo, offeringInfo, callback) {
        var productUrl = offeringInfo.productSpecification.href;
        var productPath = url.parse(productUrl).pathname;

        var options = {
            host: config.appHost,
            port: config.endpoints.catalog.port,
            path: productPath,
            method: 'GET',
            headers: {'accept': 'application/json'}
        };

        var protocol = config.appSsl ? 'https' : 'http';

        http.request(protocol, options, null, function(err, result) {
            if (err) {
                callback({
                    status: 400,
                    message: 'The product specification of the given product offering is not valid'
                })
            } else {
                callback(null, result);
            }
        });
    };

    // The request is directly allowed without extra validation required
    var validateAllowed = function(req, callback) {
        callback();
    };

    //
    // Checks if the user is logged in
    var validateLoggedIn = function(req, callback) {
        if (req.user) {
            callback();
        } else {
            callback({
                status: 401,
                message: 'You need to be authenticated to create/update/delete resources'
            });
        }
    };

    var createHandler = function(userInfo, resp, callback) {
        if (isOwner(userInfo, resp)) {
            callback();
        } else {
            callback({
                status: 403,
                message: 'The user making the request and the specified owner are not the same user'
            });
        }
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
        if (!checkRole(req.user, config.oauth2.roles.seller) && !checkRole(req.user, config.oauth2.roles.admin)) {
            callback({
                status: 403,
                message: 'You are not authorized to create resources'
            });

            return; // EXIT
        }

        if (req.url.indexOf('productOffering') > -1) {
            // Check that the product attached to the
            retrieveProduct(req.user, body, function(err, result) {
               if (err) {
                   callback(err);
               } else {
                   createHandler(req.user, JSON.parse(result.body), callback);
               }
            });
        } else if (req.url.indexOf('productSpecification') > -1) {
            // Check that the
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
        if (isOwner(userInfo, resp)) {
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
                    retrieveProduct(req.user, parsedResp, function(err, result) {
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

    var validators = {
        'GET': [ validateAllowed ],
        'POST': [ validateLoggedIn, validateCreation ],
        'PATCH': [ validateLoggedIn, validateUpdate ],
        'PUT': [ validateLoggedIn, validateUpdate ],
        'DELETE': [ validateLoggedIn, validateUpdate ]
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
