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
const utils = require('./../../lib/utils')
const tmfUtils = require('./../../lib/tmfUtils')
const axios = require('axios')
const config = require('./../../config')

const resource = (function (){

    const validateRetrieving = function(req, callback) {
        // Check if the request is a list of resources specifications
        if (req.path.endsWith('resourceSpecification') && req.user != null) {
            return tmfUtils.filterRelatedPartyFields(req, () => tmfUtils.ensureRelatedPartyIncluded(req, callback));
        } else {
            callback(null);
        }
        // validate if a resource specification is returned only by the owner
    };

    const getResourceAPIUrl = function(path) {
        const resPath = path.replace(`/${config.endpoints.resource.path}/`, '')

        return utils.getAPIURL(
            config.endpoints.resource.appSsl,
            config.endpoints.resource.host,
            config.endpoints.resource.port,
            resPath
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

    const getPrevVersion = function(req, callback) {
		retrieveAsset(req.apiUrl, (err, response) => {
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
				req.prevBody = response.body
				callback(null)
			}
		});
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

    const validateOwnerSeller = function(req, callback) {
        if (!tmfUtils.hasPartyRole(req, req.prevBody.relatedParty, 'owner') || !utils.hasRole(req.user, config.oauth2.roles.seller)) {
            callback({
                status: 403,
                message: 'Unauthorized to update non-owned/non-seller resource specs'
            });
        } else{
            callback(null)
        }
    };

    const validateUpdate = function(req, callback) {
		// Check the lifecycle updates
		const body = req.parsedBody
		const prevBody = req.prevBody

		if (body.lifecycleStatus != null && !tmfUtils.isValidStatusTransition(prevBody.lifecycleStatus, body.lifecycleStatus)) {
			// The status is being updated
			return callback({
				status: 400,
				message: `Cannot transition from lifecycle status ${prevBody.lifecycleStatus} to ${body.lifecycleStatus}`
			})
		}

		callback(null)
	}

    const validateOwnerSellerPost = function(req, callback) {
        const body = req.parsedBody

        if (!tmfUtils.hasPartyRole(req, body.relatedParty, 'owner') || !utils.hasRole(req.user, config.oauth2.roles.seller)) {
            callback({
                status: 403,
                message: 'Unauthorized to create non-owned/non-seller resource specs'
            });
        }        
        else{
            callback(null)
        }
    };

    const validators = {
        GET: [validateRetrieving],
        POST: [utils.validateLoggedIn, parseBody, validateOwnerSellerPost],
        PATCH: [utils.validateLoggedIn, parseBody, getPrevVersion, validateUpdate, validateOwnerSeller],
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
        callback(null)
    };
    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };
})()

exports.resource = resource;