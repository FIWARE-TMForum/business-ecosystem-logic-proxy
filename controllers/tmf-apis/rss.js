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
    utils = require('./../../lib/utils'),
    config = require('./../../config'),
    logger = require('./../../lib/logger').logger.getLogger('TMF'),

    rssClient = require('./../../lib/rss').rssClient;

var rss = (function () {

    var validateProvider = function (req, callback) {
        utils.log(logger, 'info', req, "Validating RSS provider");

        // Hide private APIs
        if (req.apiUrl.indexOf('rss/aggregators') >= 0) {
            return callback({
                status: 403,
                message: 'This API is private'
            });
        }

        // Only sellers are allowed to access the RSS API
        if (!utils.hasRole(req.user, config.oauth2.roles.seller)) {
            return callback({
                status: 403,
                message: 'You are not authorized to access the RSS API'
            });
        }

        // Check if the provider object has been already created
        rssClient.createProvider(req.user, function(err) {
            var status = null;
            if (err) {
                status = {
                    status: 500,
                    message: 'An unexpected error in the RSS API prevented your request to be processed'
                };
            }
            callback(status);
        });
    };

    var validateContentRequest = function(req, callback) {
        var body;

        // Hide CDRs API
        if (req.apiUrl.indexOf('rss/cdrs') >= 0) {
            return callback({
                status: 403,
                message: 'This API can only be accessed with GET requests'
            });
        }

        try {
            body = JSON.parse(req.body);
        } catch (e) {
            return callback({
                status: 400,
                message: 'The provided body is not a valid JSON'
            });
        }

        // Include the revenue model as aggregator value when creating RS models
        if (req.apiUrl.indexOf('rss/models') >= 0) {
            body.aggregatorValue = config.revenueModel;
            utils.updateBody(req, body);
        }
        callback(null);
    };

    var changeCallbackUrl = function changeCallbackUrl(req, callback) {
        if (/rss\/settlement$/.test(req.apiUrl)) {
            var body = JSON.parse(req.body);
            var url = utils.getAPIURL(
                config.endpoints.charging.appSsl, config.endpoints.charging.host, config.endpoints.charging.port, "/charging/api/reportManagement/created");

            body.callbackUrl = url;
            utils.updateBody(req, body);
        }

        callback(null);
    };

    var validators = {
        'GET': [utils.validateLoggedIn, validateProvider],
        'POST': [utils.validateLoggedIn, validateProvider, validateContentRequest, changeCallbackUrl],
        'PUT': [utils.validateLoggedIn, validateProvider, validateContentRequest],
        'DELETE': [utils.validateLoggedIn, validateProvider],
        'PATCH': [utils.methodNotAllowed]
    };

    var checkPermissions = function (req, callback) {

        var reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        async.series(reqValidators, callback);
    };

    var executePostValidation = function(req, callback) {
        logger.info("Executing RSS post validation");
        if (req.method == 'GET' && req.apiUrl.indexOf('rss/models') >= 0) {
            var body;
            // Check if the models list is empty
            try {
                body = JSON.parse(req.body);
            } catch (e) {
                // If an error parsing the body occurs this is a failure in the
                // request so the error is retransmitted
                return callback();
            }

            // If the models list is empty create the default revenue model
            if (Array.isArray(body) && !body.length) {
                rssClient.createDefaultModel(req.user, function (err, response) {
                    if (err) {
                        return callback(err);
                    }

                    body.push(JSON.parse(response.body));
                    utils.updateBody(req, body);
                    callback();
                });
            // Is a Count request
            } else if (!Array.isArray(body) && !body.size) {
                // If the count result is 0 means that the default model is not created yet.
                // It will be created in the first model request, so the 0 is changed by 1
                body = {
                    size: 1
                };

                utils.updateBody(req, body);
                callback();
            } else {
                callback();
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

exports.rss = rss;
