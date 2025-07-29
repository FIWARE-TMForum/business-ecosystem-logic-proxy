/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2025 Future Internet Consulting and Development Solutions S.L.
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

const AccountingService = require('./../../db/schemas/accountingService');
const async = require('async');
const url = require('url');
const storeClient = require('./../../lib/store').storeClient;
const utils = require('./../../lib/utils');
const tmfUtils = require('./../../lib/tmfUtils');
const config = require('./../../config');
const axios = require('axios');


const usageManagement = (function() {

    const checkFilters = function(req, callback) {
        // If retrieving the usage of a particular product
        // refresh the accounting info
        if (!!req.query && !!req.query['usageCharacteristic.orderId'] && !!req.query['usageCharacteristic.productId']) {
            return storeClient.refreshUsage(
                req.query['usageCharacteristic.orderId'],
                req.query['usageCharacteristic.productId'],
                callback
            );
        }

        // if (!!req.query && req.query['usageCharacteristic.value']) {
        //     // By default productId value
        //     req.query['usageCharacteristic.productId'] = req.query['usageCharacteristic.value'];
        //     delete req.query['usageCharacteristic.value'];
        // }

        return callback(null);
    };

    const retrieveAsset = function(path, callback) {
        const resPath = path.replace(`/${config.endpoints.usage.path}/`, '')
        
        const url = utils.getAPIURL(
            config.endpoints.usage.appSsl,
            config.endpoints.usage.host,
            config.endpoints.usage.port,
            `${config.endpoints.usage.apiPath}${resPath}`
        );

        axios.get(url).then((response) => {
            if (response.status >= 400) {
                callback({
                    status: response.status
                });
            } else {
                callback(null, {
                    status: response.status,
                    body: response.data
                });
            }
        }).catch((err) => {
            let errCb = {
                status: err.status
            }

            if (err.response) {
                errCb = {
                    status: err.response.status
                }
            }
            callback(errCb);
        })
    };

    const checkRelatedParty = function(req, callback){
        if (!req.query['relatedParty.id'] || req.user.partyId != req.query['relatedParty.id']){
            return callback({ status: 403, message: 'invalid request'})
        }

        return callback(null)
    }

    const parseBody = function (req, callback) {
        try {
            req.parsedBody = JSON.parse(req.body);
        } catch (e) {
            callback({
                status: 400,
                message: 'The provided body is not a valid JSON'
            });

            return; // EXIT
        }
        callback(null)
    }

    const validateOwner = function(req, body, callback) {
        if (!tmfUtils.hasPartyRole(req, body.relatedParty, 'owner')) {
            callback({
                status: 403,
                message: 'Unauthorized to create/update non-owned usage specs'
            });
        } else {
            callback(null)
        }
    };

    const validateOwnerCreate = function(req, callback) {
        return validateOwner(req, req.parsedBody, callback);
    }

    const validateOwnerUpdate = function(req, callback) {
        return validateOwner(req, req.prevBody, callback);
    }

    const getPrevVersion = function(req, callback) {
        retrieveAsset(req.apiUrl, (err, response) => {
            if (err) {
                if (err.status === 404) {
                    callback({
                        status: 404,
                        message: 'The required usage spec does not exist'
                    });
                } else {
                    callback({
                        status: 500,
                        message: 'The required usage spec cannot be created/updated'
                    });
                }
            } else {
                req.prevBody = response.body
                callback(null)
            }
        });
    }

    // If the usage notification to the usage management API is successful,
    // it will notify the the Store with the API response
    const executePostValidation = function(req, callback) {
        // const body = req.body;
        // const expr = /usage($|\/)/;

        // if (req.method === 'POST' && req.status === 201 && expr.test(req.apiUrl)) {
        //     storeClient.validateUsage(body, callback);
        // } else {
        //     return callback(null);
        // }
        return callback(null);
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    const validators = {
        GET: [utils.validateLoggedIn, tmfUtils.filterRelatedPartyFields, checkRelatedParty],
        POST: [utils.validateLoggedIn, parseBody, validateOwnerCreate],
        PATCH: [utils.validateLoggedIn, parseBody, getPrevVersion, validateOwnerUpdate],
        PUT: [utils.methodNotAllowed],
        DELETE: [utils.methodNotAllowed]
    };

    const checkPermissions = function(req, callback) {
        let reqValidators = [];

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
