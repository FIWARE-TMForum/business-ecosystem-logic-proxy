var async = require('async'),
    config = require('./../../config'),
    request = require('request'),
    tmfUtils = require('./../../lib/tmfUtils'),
    utils = require('./../../lib/utils');

var billing = (function() {

    var OWNER_ROLE = 'bill receiver';

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
            })
        } else {
            callback(null);
        }
    };

    var validateAppropriateRelatedParty = function(req, callback) {

        if (tmfUtils.hasPartyRole(req, req.json.relatedParty, OWNER_ROLE)) {
            callback(null);
        } else {
            callback({
                status: 403,
                message: 'The user making the request and the specified owner are not the same user'
            });
        }
    };

    var validateUpdateRelatedParty = function(req, callback) {
        if ('relatedParty' in req.json) {
            validateAppropriateRelatedParty(req, callback);
        } else {
            callback(null);
        }
    };

    var validateOwner = function(req, callback) {

        var internalUrl = utils.getAPIURL(config.appSsl, config.appHost, config.endpoints.billing.port, req.apiUrl);

        request(internalUrl, function(err, response, body) {

            if (err || response.statusCode >= 400) {

                if (response.statusCode === 404) {
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

                if (tmfUtils.hasPartyRole(req, JSON.parse(body).relatedParty, OWNER_ROLE)) {
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
        'GET': [ utils.validateLoggedIn ],
        'POST': [ utils.validateLoggedIn, validateNotInvalidFields, validateAppropriateRelatedParty ],
        'PATCH': [ utils.validateLoggedIn, validateOwner, validateNotInvalidFields, validateUpdateRelatedParty ]
        // These methods are not implemented by this API
        //'PUT': [ utils.validateLoggedIn, validateOwner, validateNotInvalidFields, validateAppropriateRelatedParty ],
        //'DELETE': [ utils.validateLoggedIn, validateOwner ]
    };

    var checkPermissions = function(req, callback) {

        // TODO: To be removed when the rest of features are supported
        var apiPathRegExp = new RegExp('^/' + config.endpoints.billing.path + '/api/billingManagement/v2/billingAccount');

        if (apiPathRegExp.test(req.apiUrl)) {

            var reqValidators = [];

            if (req.method in validators) {

                try {

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
                })
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
                callback({
                    status: 403,
                    message: 'Unauthorized to retrieve the list of billing accounts'
                });
            } else {
                // This checks that the user is included in the list of related parties...
                if (tmfUtils.isRelatedParty(req, account.relatedParty)) {
                    callback(null);
                } else {
                    callback({
                        status: 403,
                        message: 'Unauthorized to retrieve the specified billing account'
                    });
                }
            }
        } else {
            callback();
        }
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };

})();

exports.billing = billing;