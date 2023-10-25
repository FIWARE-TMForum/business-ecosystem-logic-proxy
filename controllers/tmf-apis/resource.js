/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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
const utils = require('./../../lib/utils')
const tmfUtils = require('./../../lib/tmfUtils')
const axios = require('axios')
const config = require('./../../config')

var resource = (function (){

    var validateRetrieving = function(req, callback) {
        // Check if the request is a list of resources specifications
        if (req.path.endsWith('resourceSpecification')) {
            return tmfUtils.filterRelatedPartyFields(req, () => tmfUtils.ensureRelatedPartyIncluded(req, callback));
        } else {
            callback(null);
        }
        // validate if a resource specification is returned only by the owner
    };

    var getResourceAPIUrl = function(path) {
        return utils.getAPIURL(
            config.endpoints.resource.appSsl,
            config.endpoints.resource.host,
            config.endpoints.resource.port,
            path
        );
    };
    const retrieveAsset = function(path, callback) {
        const uri = getResourceAPIUrl(path);

        axios.get(uri).then((response) => {
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
            callback({
                status: err.response.status
            });
        })
    };

    
    var validateOwnerSeller = function(req, callback) {
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
                        message: 'The required resource cannot be created/updated'
                    });
                }
            } else {
                if (!tmfUtils.hasPartyRole(req, response.body.relatedParty, 'owner') || !utils.hasRole(req.user, config.oauth2.roles.seller)) {
                    callback({
                        status: 403,
                        message: 'Unauthorized to update non-owned/non-seller resources'
                    });
                }        
                else{
                    callback(null)
                }
            }
        });
    };

    var validateOwnerSellerPost = function(req, callback) {
        if (!tmfUtils.hasPartyRole(req, req.body.relatedParty, 'owner') || !utils.hasRole(req.user, config.oauth2.roles.seller)) {
            callback({
                status: 403,
                message: 'Unauthorized to create non-owned/non-seller resources'
            });
        }        
        else{
            callback(null)
        }
    };

    var validators = {
        GET: [utils.validateLoggedIn,  validateRetrieving],
        POST: [utils.validateLoggedIn, validateOwnerSellerPost],
        PATCH: [utils.validateLoggedIn, validateOwnerSeller],
        PUT: [utils.methodNotAllowed],
        DELETE: [utils.methodNotAllowed]
    };

    var checkPermissions = function(req, callback) {
        var reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        async.series(reqValidators, callback);
    };

    var executePostValidation = function(response, callback) {
        var body = response.body

        // Check if the user is allowed to retrieve the requested resource specification
        if (!Array.isArray(body) && !tmfUtils.hasPartyRole(response, body.relatedParty, 'owner')) {
            callback({
                status: 403,
                message: 'You are not authorized to retrieve the specified resource specification from the catalog'
            });
        } else {
            callback(null);
        }
    };
    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };
})()

exports.resource = resource;