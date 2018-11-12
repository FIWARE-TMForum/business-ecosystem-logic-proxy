/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the business-ecosystem-logic-proxy of the
 * Business API Ecosystem
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var async = require('async'),
    config = require('./../../config'),
    logger = require('./../../lib/logger').logger.getLogger('TMF'),
    request = require('request'),
    tmfUtils = require('./../../lib/tmfUtils'),
    url = require('url'),
    utils = require('./../../lib/utils');

var customer = (function() {

    var getCustomerPath = function(asset) {
        return url.parse(asset.customer.href).pathname;
    };

    var getCustomerAPIUrl = function(path) {
        return utils.getAPIURL(config.endpoints.customer.appSsl, config.endpoints.customer.host, config.endpoints.customer.port, path);
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

    var validateRetrieval = function(req, callback) {

        if (req.isCollection && req.isAccount) {
            // At this point, it is not worth implementing the functionality to list customer accounts
            callback({
                status: 403,
                message: 'Unauthorized to retrieve the list of customer accounts'
            });
        } else if (req.isCollection && !req.isAccount) {
            tmfUtils.filterRelatedPartyFields(req, callback);
        } else {
            // When retrieving single resource, the executePostvalidation function will check
            // that the user can actually retrieve that resource.
            callback(null);
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

        if (req.isAccount) {

            var accountValidation = validateAccount(req.json);

            if (accountValidation.valid) {
                isOwner(req, req.json, 'The given Customer does not belong to the user making the request', callback);
            } else {
                callback({
                    status: 422,
                    message: accountValidation.message
                });
            }

        } else {

            if ('relatedParty' in req.json) {
                isOwner(req, req.json, 'Related Party does not match with the user making the request', callback);
            } else {
                callback({
                    status: 422,
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

    var validateCustomerAccountNotIncluded = function(req, callback) {

        if (!req.isAccount && 'customerAccount' in req.json) {
            callback({
                status: 403,
                message: 'Customer Account cannot be manually modified'
            });
        } else {
            callback(null);
        }
    };

    var validators = {
        'GET': [ utils.validateLoggedIn, validateRetrieval ],
        'POST': [ utils.validateLoggedIn, validateCreation, validateCustomerAccountNotIncluded ],
        'PATCH': [ utils.validateLoggedIn, validateUpdateOwner, validateIDNotModified, validateCustomerAccountNotIncluded ],
        // This method is not implemented by this API
        //'PUT': [ utils.validateLoggedIn, validateOwner, validateCreation ],
        'DELETE': [ utils.validateLoggedIn, validateUpdateOwner ]
    };

    var checkPermissions = function(req, callback) {

        var pathRegExp = new RegExp('^/' + config.endpoints.customer.path + '/api/customerManagement/v2/customer(Account)?(/(.*))?$');
        var apiPath = url.parse(req.apiUrl).pathname;
        var regExpResult = pathRegExp.exec(apiPath);

        if (regExpResult) {

            req.isCollection = regExpResult[3] ? false : true;
            req.isAccount = regExpResult[1] ? true : false;

            if (req.method in validators) {

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
                    status: 405,
                    message: 'Method not allowed'
                });
            }
        } else {
            callback({
                status: 403,
                message: 'This API feature is not supported yet'
            });
        }
    };

    var attachCustomerAccount = function(proxyRes, callback) {

        // This is just to update the customer resource by including the created account in the
        // list of customer accounts. If an error arises, it is ignored as this step is not
        // mandatory so callback is always called with "null".

        var createdAccount = proxyRes.json;
        var customerPath = getCustomerPath(createdAccount);

        retrieveAsset(customerPath, function(err, result) {

            if (err) {
                utils.log(logger, 'warn', proxyRes, 'Impossible to load attached Customer');
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

                        utils.log(logger, 'warn', proxyRes, message);
                    }

                    return callback(null);

                });

            }
        });
    };

    var checkIsRelatedSeller = function(proxyRes, ids, callback) {

        // Ask Billing API for those Billing Accounts related to the customer so we can determine
        // whether a seller is able (or not) to retrieve the billing address of this customer.

        var billingPath = config.endpoints.billing.path + '/api/billingManagement/v2/billingAccount?customerAccount.id=' +
            ids.join(',');
        var billingUrl = utils.getAPIURL(config.endpoints.billing.appSsl, config.endpoints.billing.host, config.endpoints.billing.port, billingPath);

        request(billingUrl, function(err, response, body) {

            if (!err && response.statusCode === 200) {

                var billingAccounts = JSON.parse(body);

                var allowed = billingAccounts.some(function(item) {
                    return tmfUtils.isRelatedParty(proxyRes, item.relatedParty);
                });

                if (allowed) {
                    callback(null);
                } else {
                    callback({
                        status: 403,
                        message: 'Unauthorized to retrieve the information of the given customer'
                    });
                }

            } else {
                callback({
                    status: 500,
                    message: 'An error arises at the time of retrieving associated billing accounts'
                });
            }
        });
    };

    var executePostValidation = function(proxyRes, callback) {

        // This is not supposed to fail since this method is only called when the request to the
        // actual server is OK!
        proxyRes.json = JSON.parse(proxyRes.body);

        if (proxyRes.method === 'GET') {

            if (!Array.isArray(proxyRes.json)) {
                isOwner(proxyRes, proxyRes.json, 'Unauthorized to retrieve the given customer profile', function(err) {

                    if (err) {

                        var customerAccountsIds = null;

                        if ('customerAccount' in proxyRes.json) {
                            // Resource: Customer
                            customerAccountsIds = proxyRes.json.customerAccount.map(function (item) {
                                return item.id;
                            });
                        } else if ('customer' in proxyRes.json) {
                            // Resource: CustomerAccount
                            customerAccountsIds = [proxyRes.json.id];
                        }

                        if (customerAccountsIds && err.status === 403) {
                            // Billing Addresses can be retrieved by involved sellers
                            checkIsRelatedSeller(proxyRes, customerAccountsIds, callback);
                        } else {
                            callback(err);
                        }

                    } else {
                        callback(null);
                    }
                });
            } else {
                // checkPermissions filters the requests to list customer accounts.
                // checkPermissions ensures that users can only retrieve the list
                // of customer they own.
                callback(null);
            }

        } else if (proxyRes.method === 'POST' && 'customer' in proxyRes.json) {
            attachCustomerAccount(proxyRes, callback);
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