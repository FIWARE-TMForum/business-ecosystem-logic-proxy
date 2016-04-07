var async = require('async'),
    config = require('./../../config'),
    tmfUtils = require('./../../lib/tmfUtils'),
    request = require('request'),
    url = require('url'),
    utils = require('./../../lib/utils');

var customer = (function() {

    var retrieveAsset = function(path, callback) {

        var uri = utils.getAPIURL(config.appSsl, config.appHost, config.endpoints.customer.port, path);

        request(uri, function(err, response, body) {

            if (err || response.statusCode >= 400) {
                callback({
                    status: response ? response.statusCode : 500
                });
            } else {
                callback(null, {
                    status: response.statusCode,
                    body: body
                });
            }
        });
    };

    var isOwner = function(req, asset, notAuthorizedMessage, callback) {

        if ('customer' in asset) {

            // Customer Account - The attached customer need to be checked
            var customerPath = url.parse(asset.customer.href).pathname;

            retrieveAsset(customerPath, function(err, result) {

                if (err) {
                    callback({
                        status: 500,
                        message: 'The attached customer cannot be retrieved'
                    });
                } else {

                    var customer = JSON.parse(result.body);

                    if (tmfUtils.hasPartyRole(req, [ customer.relatedParty ], 'owner')) {
                        callback(null);
                    } else {
                        callback({
                            status: 403,
                            message: notAuthorizedMessage
                        })
                    }
                }
            });
        } else {

            // Customer - Related party is directly included

            if (tmfUtils.hasPartyRole(req, [ asset.relatedParty ], 'owner')) {
                callback(null);
            } else {
                callback({
                    status: 403,
                    message: notAuthorizedMessage
                });
            }
        }
    };

    var validateUpdateOwner = function(req, callback) {

        retrieveAsset(req.apiUrl, function(err, response) {

            if (err) {

                if (err.status === 404) {
                    callback({
                        status: 404,
                        message: 'The required resource does not exist'
                    });
                } else {
                    callback({
                        status: 500,
                        message: 'The required resource cannot be retrieved'
                    });
                }
            } else {
                isOwner(req, JSON.parse(response.body), 'Unauthorized to update/delete non-owned resources', callback);
            }
        });
    };

    var validateCreation = function(req, callback) {

        var isAccount = req.apiUrl.indexOf('customerAccount') >= 0;

        if (isAccount && !('customer' in req.json)) {
            callback({
                status: 400,
                message: 'Unable to create customer account without specifying the associated customer'
            });
        } else if (!isAccount && !('relatedParty' in req.json)) {
            callback({
                status: 400,
                message: 'Unable to create customer without specifying the related party'
            });
        } else {
            var errorMessage = isAccount ? 'The given Customer does not belong to the user making the request' :
                'Related Party does not match with the user making the request';

            isOwner(req, req.json, errorMessage, callback);
        }
    };

    var validateIDNotModified = function(req, callback) {

        var error = null;

        if ('relatedParty' in req.json) {
            error = {
                status: 403,
                message: 'Related Party cannot be modified'
            };
        } else if ('customer' in req.json) {
            error = {
                status: 403,
                message: 'Customer cannot be modified'
            };
        }

        callback(error);
    };

    var validators = {
        'GET': [ utils.validateLoggedIn ],
        'POST': [ utils.validateLoggedIn, validateCreation ],
        'PATCH': [ utils.validateLoggedIn, validateUpdateOwner, validateIDNotModified ],
        // This method is not implemented by this API
        //'PUT': [ utils.validateLoggedIn, validateOwner, validateCreation ],
        'DELETE': [ utils.validateLoggedIn, validateUpdateOwner ]
    };

    var checkPermissions = function(req, callback) {

        var pathRegExp = new RegExp('^/' + config.endpoints.customer.path + '/api/customerManagement/v2/customer(Account)?');

        if (pathRegExp.test(req.apiUrl)) {

            try {

                var reqValidators = [];

                if (req.body && typeof(req.body) === 'string') {
                    req.json = JSON.parse(req.body);
                }

                for (var i in validators[req.method]) {
                    reqValidators.push(validators[req.method][i].bind(this, req));
                }

                async.series(reqValidators, callback);

            } catch (e) {
                callback({
                    status: 400,
                    message: 'Invalid body'
                });
            }
        } else {
            callback({
                status: 403,
                message: 'This API feature is not supported yet'
            });
        }
    };

    var executePostValidation = function(req, callback) {

        if (req.method === 'GET') {

            var parsedBody = JSON.parse(req.body);

            if (!Array.isArray(parsedBody)) {
                isOwner(req, parsedBody, 'Unauthorized to retrieve non-owned products', callback);
            } else {
                callback({
                    status: 403,
                    message: 'Unauthorized to list customers or customer accounts'
                });
            }

        } else {
            callback(null);
        }

    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };

})();

exports.customer = customer;