var async = require('async'),
    config = require('./../../config'),
    logger = require('./../../lib/logger').logger.getLogger('TMF'),
    request = require('request'),
    tmfUtils = require('./../../lib/tmfUtils'),
    url = require('url'),
    utils = require('./../../lib/utils');

var customer = (function() {

    var isCustomerAccount = function(req) {
        return req.apiUrl.indexOf('/customerAccount') >= 0;
    };

    var getCustomerPath = function(asset) {
        return url.parse(asset.customer.href).pathname;
    };

    var getCustomerAPIUrl = function(path) {
        return utils.getAPIURL(config.appSsl, config.appHost, config.endpoints.customer.port, path);
    };

    var retrieveAsset = function(path, callback) {

        var uri = getCustomerAPIUrl(path);

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
            var customerPath = getCustomerPath(asset);

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

    var validateAccount = function(account) {

        var message = null;

        if (!('customer' in account)) {
            message = 'Customer Accounts must be associated to a Customer'
        } else {

            // HREF will be validated later at the time of checking the ownership
            if (!account.customer.href.endsWith('/' + account.customer.id)) {
                message = 'Customer ID and Customer HREF mismatch'
            }
        }

        return {
            valid: message ? false : true,
            message: message
        }
    };

    var validateCreation = function(req, callback) {

        var isAccount = isCustomerAccount(req);

        if (isAccount) {

            var accountValidation = validateAccount(req.json);

            if (accountValidation.valid) {
                isOwner(req, req.json, 'The given Customer does not belong to the user making the request', callback);
            } else {
                callback({
                    status: 400,
                    message: accountValidation.message
                });
            }

        } else {

            if (('relatedParty' in req.json)) {
                isOwner(req, req.json, 'Related Party does not match with the user making the request', callback);
            } else {
                callback({
                    status: 400,
                    message: 'Unable to create customer without specifying the related party'
                });
            }

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

    var attachCustomerAccount = function(req, callback) {

        // This is just to update the customer resource by including the created account in the
        // list of customer accounts. If an error arises, it is ignored as this step is not
        // mandatory so callback is always called with "null".

        var createdAccount = JSON.parse(req.body);
        var customerPath = getCustomerPath(createdAccount);

        retrieveAsset(customerPath, function(err, result) {

            if (err) {
                utils.log(logger, 'warn', req, 'Impossible to load the Customer');
                return callback(null);
            } else {

                var currentCustomerAccounts = JSON.parse(result.body).customerAccount;

                currentCustomerAccounts.push({
                    id: createdAccount.id,
                    href: createdAccount.href,
                    name: createdAccount.name,
                    status: 'Active'
                });

                var options = {
                    url: getCustomerAPIUrl(customerPath),
                    method: 'PATCH',
                    json: { customerAccount: currentCustomerAccounts }
                };

                request(options, function(err, response) {

                    if (err || response.statusCode >= 400) {

                        var message = 'Impossible to update the list of customer accounts: ';
                        message += err ? err : response.statusCode;

                        utils.log(logger, 'warn', req, message);
                    }

                    return callback(null);

                });

            }
        });
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

        } else if (req.method === 'POST' && isCustomerAccount(req) ) {
            attachCustomerAccount(req, callback);
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