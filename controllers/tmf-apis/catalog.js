var config = require('./../../config.js'),
    http = require('./../../lib/httpClient.js'),
    storeClient = require('./../../lib/store.js').storeClient,
    url = require('url'),
    utils = require('./../../lib/utils.js'),
    log = require('./../../lib/logger').logger.getLogger("Root");

// Validator to check user permissions for accessing TMForum resources
var catalog = (function() {

    // Check whether the owner role is included in the info field
    var isOwner = function (userInfo, info) {
        var status = false;
        if (info.relatedParty) {
            var parties = info.relatedParty;

            for(var i = 0; !status && i < parties.length; i++) {
                var party = parties[i];

                if (party.role == 'Owner' && party.id == userInfo.id) {
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
            if (userInfo.roles[i].id === role) {
                valid = true;
            }
        }

        return valid;
    };

    // Check that the user is the owner of the resource
    var checkUser = function(userInfo, resp) {
        return isOwner(userInfo, resp);
    };

    // Retrieves the product belonging to a given offering
    var retrieveProduct = function(userInfo, offeringInfo, callback, callbackError) {
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

        http.request(protocol, options, '', callback, function() {
            callbackError(400, 'The product specification of the given product offering is not valid');
        });
    };

    // The request is directly allowed without extra validation required
    var validateAllowed = function(req, callback) {
        callback();
    };

    var createHandler = function(userInfo, resp, callback, callbackError) {
        if (isOwner(userInfo, resp)) {
            callback();
        } else {
            callbackError(403, 'The user making the request and the specified owner are not the same user');
        }
    };

    // Validate the creation of a resource
    var validateCreation = function(req, callback, callbackError) {
        var body;

        // The request body may not be well formed
        try {
            body = JSON.parse(req.body);
        } catch (e) {
            callbackError(400, 'The resource is not a valid JSON document');
            return;
        }

        // Check that the user has the seller role
        if (!checkRole(req.user, config.oauth2.roles.seller)) {
            callbackError(403, 'You are not authorized to create resources');
            return;
        }

        if (req.url.indexOf('productOffering') > -1) {
            // Check that the product exist
            retrieveProduct(req.user, body, function (status, resp) {
                createHandler(req.user, JSON.parse(resp), callback, callbackError);
            }, callbackError);

        } else if (req.url.indexOf('productSpecification') > -1) {
            storeClient.validateProduct(req.body, req.user, function() {
                createHandler(req.user, body, callback, callbackError);
            }, callbackError);
        } else {
            createHandler(req.user, body, callback, callbackError);
        }
    };

    var updateHandler = function(userInfo, resp, callback, callbackError) {
        if (checkUser(userInfo, resp)) {
            callback();
        } else {
            callbackError(403, 'The user making the request is not the owner of the accessed resource');
        }
    };

    // Validate the modification of a resource
    var validateUpdate = function(req, callback, callbackError) {
        var options = {
            host: config.appHost,
            port: config.endpoints.catalog.port,
            path: req.url,
            method: 'GET',
            headers: {'accept': 'application/json'}
        };

        var protocol = config.appSsl ? 'https' : 'http';

        // Retrieve the resource to be updated or removed
        http.request(protocol, options, '', function(status, resp) {
            var parsedResp = JSON.parse(resp);

            // Check if the request is an offering
            if (req.url.indexOf('productOffering') > -1) {
                retrieveProduct(req.user, parsedResp, function (status, response) {
                    updateHandler(req.user, JSON.parse(response), callback, callbackError);
                }, callbackError);

            } else {
                updateHandler(req.user, parsedResp, callback, callbackError);
            }
        });
    };

    var validators = {
        'GET': validateAllowed,
        'POST': validateCreation,
        'PATCH': validateUpdate,
        'PUT': validateUpdate,
        'DELETE': validateUpdate
    };

    var checkPermissions = function (req, callback, callbackError) {

        log.info('Checking Catalog permissions');
        // Check if the user is admin of the application
        if (checkRole(req.user, config.oauth2.roles.admin)) {
            callback();
        } else {
            validators[req.method](req, callback, callbackError);
        }
    };

    return {
        checkPermissions: checkPermissions
    };

})();

exports.catalog = catalog;
