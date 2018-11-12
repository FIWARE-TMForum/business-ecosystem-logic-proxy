/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
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
    request = require('request'),
    tmfUtils = require('./../../lib/tmfUtils'),
    url = require('url'),
    utils = require('./../../lib/utils');

var billing = (function() {

    var OWNER_ROLE = config.billingAccountOwnerRole;

    var makeRequest = function(url, callback) {

        request(url, function (err, response, body) {
            if (err || response.statusCode >= 400) {
                callback({
                    status: response.statusCode ? response.statusCode : 500
                });
            } else {
                callback(null, JSON.parse(body));
            }

        });
    };

    var validateProductCharge = function(req, productId, callback) {
        // Check that the specified product id belongs to the user
        var productUrl = utils.getAPIURL(
            config.endpoints.inventory.appSsl, config.endpoints.inventory.host, config.endpoints.inventory.port,
            config.endpoints.inventory.path + '/api/productInventory/v2/product/' + productId);

        makeRequest(productUrl, function(err, product) {
            if (err) {
                return callback({
                    status: 422,
                    message: 'It has not been possible to validate The specified product id'
                });
            }

            if (!tmfUtils.isOrderingCustomer(req.user, product)[1]) {
                return callback({
                    status: 403,
                    message: 'You are not authorized to retrieve charges related to the specified product id'
                });
            }
            return callback(null);
        });
    };

    var validateRetrieval = function(req, callback) {

        // req.isCollection has been previously sent (checkPermissions)
        if (req.isCollection) {
            if (req.apiUrl.indexOf('billingAccount') > -1) {
                // Validate billing accounts retrieval
                return tmfUtils.filterRelatedPartyFields(req, callback);
            } else {
                // Validate charges retrieval
                if (!req.query['serviceId.id']) {
                    return callback({
                        status: 422,
                        message: 'Please specify a concrete product id using the query string serviceId.id'
                    })
                }
                validateProductCharge(req, req.query['serviceId.id'], callback);
            }
        } else {
            return callback(null);
        }
    };

    var validateCustomerAccount = function(req, callback) {

        if ('customerAccount' in req.json && 'href' in req.json.customerAccount) {

            var customerAccountPath = url.parse(req.json.customerAccount.href).pathname;
            var customerAccountUrl = utils.getAPIURL(config.endpoints.customer.appSsl, config.endpoints.customer.host, config.endpoints.customer.port, customerAccountPath);

            makeRequest(customerAccountUrl, function(err, body) {

                if (err) {
                    callback({
                        status: 422,
                        message: 'The given customer account cannot be retrieved'
                    });
                } else {

                    var customerPath = url.parse(body.customer.href).pathname;
                    var customerUrl = utils.getAPIURL(config.endpoints.customer.appSsl, config.endpoints.customer.host, config.endpoints.customer.port, customerPath);

                    makeRequest(customerUrl, function(err, body) {

                        if (err) {
                            callback({
                                status: 422,
                                message: 'The customer attached to the customer account given cannot be retrieved'
                            });
                        } else {

                            if (tmfUtils.hasPartyRole(req, [ body.relatedParty ], 'owner')) {
                                callback(null);
                            } else {
                                callback({
                                    status: 403,
                                    message: 'The given customer account does not belong to the user making the request'
                                });
                            }
                        }
                    });
                }
            });

        } else {
            if (req.method === 'POST') {
                callback({
                    status: 422,
                    message: 'customerAccount field is mandatory'
                });
            } else {
                // When updating billing accounts, customerAccount field is not mandatory
                callback(null);
            }
        }
    };

    var validateNotInvalidFields = function(req, callback) {

        var invalidFields = ['customerBillingCycleSpecification', 'customerBillFormat',
            'customerBillPresentationMedia', 'currency', 'billingAccountBalance', 'paymentMean'];

        var containInvalidField = invalidFields.some(function(field) {
            return field in req.json;
        });

        if (containInvalidField) {
            callback({
                status: 422,
                message: 'One or more of the included fields are not supported yet'
            });
        } else {
            callback(null);
        }
    };

    var validateRelatedParty = function(req, callback) {

        var relatedPartyField = 'relatedParty';

        // Creation request must include relatedParty field. Otherwise, an error must be arisen

        if (req.method === 'POST' && !(relatedPartyField in req.json)) {
            callback({
                status: 422,
                message: 'Billing Accounts cannot be created without related parties'
            })
        } else {

            // This part only be executed for update requests or for creation requests that include
            // the relatedParty field.

            if (!(relatedPartyField in req.json) || tmfUtils.hasPartyRole(req, req.json.relatedParty, OWNER_ROLE)) {
                callback(null);
            } else {
                callback({
                    status: 403,
                    message: 'The user making the request and the specified owner are not the same user'
                });
            }

        }
    };

    var validateOwner = function(req, callback) {

        var internalUrl = utils.getAPIURL(config.endpoints.billing.appSsl, config.endpoints.billing.host, config.endpoints.billing.port, req.apiUrl);

        makeRequest(internalUrl, function(err, body) {

            if (err) {

                if (err.status === 404) {
                    callback({
                        status: 404,
                        message: 'The given billing account does not exist'
                    });
                } else {
                    callback({
                        status: 500,
                        message: 'The given billing account cannot be accessed'
                    });
                }
            } else {

                if (tmfUtils.hasPartyRole(req, body.relatedParty, OWNER_ROLE)) {
                    callback(null);
                } else {

                    var action = req.method.toUpperCase() === 'DELETE' ? 'delete' : 'update';

                    callback({
                        status: 403,
                        message: 'You are not authorized to ' + action + ' this billing account'
                    });
                }
            }
        });
    };

    var validators = {
        'GET': [ utils.validateLoggedIn, validateRetrieval ],
        'POST': [ utils.validateLoggedIn, validateNotInvalidFields, validateRelatedParty, validateCustomerAccount ],
        'PATCH': [ utils.validateLoggedIn, validateOwner, validateNotInvalidFields, validateRelatedParty, validateCustomerAccount ]
        // These methods are not implemented by this API
        //'PUT': [ utils.validateLoggedIn, validateOwner, validateNotInvalidFields, validateAppropriateRelatedParty ],
        //'DELETE': [ utils.validateLoggedIn, validateOwner ]
    };

    var checkPermissions = function(req, callback) {

        // TODO: To be removed when the rest of features are supported
        var apiPathRegExp = new RegExp('^/' + config.endpoints.billing.path + '/api/billingManagement/v2/billingAccount(/(.*))?$');
        var apiChargeRegExp = new RegExp('^/' + config.endpoints.billing.path + '/api/billingManagement/v2/appliedCustomerBillingCharge/?$');

        var apiPath = url.parse(req.apiUrl).pathname;

        var regExpResult = apiPathRegExp.exec(apiPath);
        var chargeRegExpResult = apiChargeRegExp.exec(apiPath);

        if (regExpResult || chargeRegExpResult) {

            var appliedRegExp = regExpResult ? regExpResult : chargeRegExpResult;
            req.isCollection = appliedRegExp[2] ? false : true;

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

    var executePostValidation = function(req, callback) {

        if (req.method === 'GET') {

            var account = JSON.parse(req.body);

            if (Array.isArray(account)) {
                // checkPermissions ensures that only owned billing accounts are retrieved
                return callback(null);

            } else if (req.apiUrl.indexOf('billingAccount') > -1) {
                // This checks that the user is included in the list of related parties...
                if (tmfUtils.isRelatedParty(req, account.relatedParty)) {
                    return callback(null);
                } else {
                    return callback({
                        status: 403,
                        message: 'Unauthorized to retrieve the specified billing account'
                    });
                }

            } else {
                // Check that the user can retrieve the specified charge
                validateProductCharge(req, account.serviceId[0].id, callback);
            }
        } else {
            return callback(null);
        }
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };

})();

exports.billing = billing;