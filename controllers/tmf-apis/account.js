/* Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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

const async = require('async')
const axios = require('axios')
const config = require('./../../config')
const logger = require('./../../lib/logger').logger.getLogger('TMF')
const tmfUtils = require('./../../lib/tmfUtils')
const url = require('url')
const utils = require('./../../lib/utils')

const account = (function() {

    const validateCreation = function (req, callback) {
        console.log(req.json)

        // Missing related party info
        if (!('relatedParty' in req.json) || req.json.relatedParty.length == 0) {
            return callback({
                status: 400,
                message: "Missing relatedParty field"
            })
        }

        // Check the user making the request is the expected owner
        if (!tmfUtils.isOwner(req, req.json)) {
            return callback({
                status: 403,
                message: "The user making the request is not the specified owner"
            })
        }


        callback(null)
    }

    const validateRetrieval = function(req, callback) {
        return tmfUtils.filterRelatedPartyFields(req, () => {
            tmfUtils.ensureRelatedPartyIncluded(req, callback)
        });
    }

    const validateUpdate = function(req, callback) {
        const path = req.apiUrl.replace('/' + config.endpoints.account.path, '')
        const uri = utils.getAPIURL(
            config.endpoints.account.appSsl,
            config.endpoints.account.host,
            config.endpoints.account.port,
            path
        );

        axios.get(uri).then((response) => {
            if (!tmfUtils.isOwner(req, response.data)) {
                return callback({
                    status: 403,
                    message: "The user making the request is not the specified owner"
                })
            }
            callback(null)
        }).catch((err) => {
            callback({
                status: err.response.status
            });
        })
    }

    const validators = {
        GET: [utils.validateLoggedIn, validateRetrieval],
        POST: [utils.validateLoggedIn, validateCreation],
        PATCH: [utils.validateLoggedIn, validateUpdate],
        DELETE: [utils.methodNotAllowed]
    };

    const checkPermissions = function(req, callback) {
        const pathRegExp = new RegExp(
            '^/' + config.endpoints.account.path + '?(/(.*))?$'
        );

        const apiPath = url.parse(req.apiUrl).pathname;
        const regExpResult = pathRegExp.exec(apiPath);

        if (regExpResult) {
            req.isCollection = regExpResult[3] ? false : true;
            req.isAccount = regExpResult[1] ? true : false;

            if (req.method in validators) {
                try {
                    var reqValidators = [];

                    if (req.body && typeof req.body === 'string') {
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

    var executePostValidation = function(proxyRes, callback) {
        callback(null);
    }
    
    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };

})();

exports.account = account;
