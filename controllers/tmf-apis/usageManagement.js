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

    var checkFilters = function (req, callback) {
        // If retrieving the usage of a particular product
        // refresh the accounting info
        if (!!req.query && !!req.query['usageCharacteristic.orderId'] && !!req.query['usageCharacteristic.productId']) {
            return storeClient.refreshUsage(req.query['usageCharacteristic.orderId'], req.query['usageCharacteristic.productId'], callback);
        }

        if (!!req.query && req.query['usageCharacteristic.value']){
            // By default productId value
            req.query['usageCharacteristic.productId'] = req.query['usageCharacteristic.value'];
            delete req.query['usageCharacteristic.value'];
        }

        return callback(null);
    };

    // If the usage notification to the usage management API is successful, 
    // it will notify the the Store with the API response
    var executePostValidation = function (req, callback) {

        var body = JSON.parse(req.body);

        var expr = /usage($|\/)/;

        if (req.method === 'POST' && req.status === 201 && expr.test(req.apiUrl)) {
            storeClient.validateUsage(body, callback);
        } else {
            return callback(null);
        }
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var validators = {
        'GET': [ utils.validateLoggedIn, tmfUtils.filterRelatedPartyFields, checkFilters ],
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