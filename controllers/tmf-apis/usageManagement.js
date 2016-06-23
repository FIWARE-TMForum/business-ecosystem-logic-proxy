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

var AccountingService = require('./../../db/schemas/accountingService'),
    async = require('async'),
    url = require('url'),
    storeClient = require('./../../lib/store').storeClient,
    utils = require('./../../lib/utils'),
    tmfUtils = require('./../../lib/tmfUtils');

var usageManagement = ( function () {

    /**
     * Check if the API Key passed is a valid API Key
     *
     * @param  {Object}   req      Incoming request.
     */
    var validateApiKey = function (req, callback) {

        var apiKey = req.get('X-API-KEY');

        if (!apiKey) {

            return callback({
                status: 401,
                message: 'Missing header "X-API-KEY"'
            });

        } else {

            AccountingService.findOne( {apiKey: apiKey}, function (err, result) {

                var res;

                if (err) {

                    res = {
                        status: 500,
                        message: 'Error validating apiKey'
                    };

                } else if (!result) {

                    res = {
                        status: 401,
                        message: 'Invalid apikey'
                    };

                } else if (result.state !== 'COMMITTED') {

                    res = {
                        status: 401,
                        message: 'Apikey uncommitted'
                    };

                } else {
                    res = null;
                }

                return callback(res);
            });
        }
    };

    // If the usage notification to the usage management API is successful, 
    //  it will notify the the Store with the API response
    var executePostValidation = function (req, callback) {

        var body = JSON.parse(req.body);

        var expr = /usage($|\/)/;
        var parsedUrl = url.parse(req.apiUrl, true);

        if (req.method === 'POST' && req.status === 201 && expr.test(req.apiUrl)) {

            storeClient.validateUsage(body, callback);

        } else if (req.method === 'GET' && expr.test(parsedUrl.pathname)){
            // Check if is needed to filter the list
            var query = parsedUrl.query;

            if (query['usageCharacteristic.value']) {
                var productValue = query['usageCharacteristic.value'];
                var filteredBody = body.filter(function(usage) {
                    var valid = false;
                    var characteristics = usage.usageCharacteristic;

                    for (var i = 0; i < characteristics.length && !valid; i++) {
                        if (characteristics[i].name.toLowerCase() == 'productid' &&
                                characteristics[i].value == productValue) {
                            valid = true;
                        }
                    }

                    return valid;
                });

                // Attach new body
                utils.updateBody(req, filteredBody);
            }
            return callback(null);
        } else {
            return callback(null);
        }
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var validators = {
        'GET': [ utils.validateLoggedIn, tmfUtils.filterRelatedPartyFields ],
        'POST': [ validateApiKey ],
        'PATCH': [ utils.methodNotAllowed ],
        'PUT': [ utils.methodNotAllowed ],
        'DELETE': [ utils.methodNotAllowed ]
    };

    var checkPermissions = function (req, callback) {

        var reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        async.series(reqValidators, callback);
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };

})();

exports.usageManagement = usageManagement;