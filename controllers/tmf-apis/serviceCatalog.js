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
const utils = require('./../../lib/utils')
const tmfUtils = require('./../../lib/tmfUtils')
const storeClient = require('./../../lib/store').storeClient
const serviceCatalog = (function() {
	const servicePattern = new RegExp('/serviceSpecification/[^/]+/?$');
	const validateRetrieving = function(req, callback) {
        // Check if the request is a list of service specifications
        if (req.path.endsWith('serviceSpecification') && req.user != null) {
            return tmfUtils.filterRelatedPartyFields(req, (err) => {
				if (err) {
					return callback(err)
				}

				tmfUtils.ensureRelatedPartyIncluded(req, callback)
			});
        } else {
            callback(null);
        }
        // validate if a service specification is returned only by the owner
    };

	var getResourceAPIUrl = function(path) {
		const resPath = path.replace(`/${config.endpoints.service.path}/`, '')

		return utils.getAPIURL(
			config.endpoints.service.appSsl,
			config.endpoints.service.host,
			config.endpoints.service.port,
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
			callback({
				status: err.response.status
			});
		})
	};

	const validateOwnerSeller = function(req, callback) {
		retrieveAsset(req.apiUrl, function(err, response) {
			if (err) {
				if (err.status === 404) {
					callback({
						status: 404,
						message: 'The required service does not exist'
					});
				} else {
					callback({
						status: 500,
						message: 'The required service cannot be created/updated'
					});
				}
			} else {
				if (!tmfUtils.hasPartyRole(req, response.body.relatedParty, 'owner') || !utils.hasRole(req.user, config.oauth2.roles.seller)) {
					callback({
						status: 403,
						message: 'Unauthorized to update non-owned/non-seller services'
					});
				} else {
					callback(null)
				}
			}
		});
	};

	const validateCreation = function(req, callback){
		let body;
		try {
			body = JSON.parse(req.body);
		} catch (e) {
			callback({
				status: 400,
				message: 'The provided body is not a valid JSON'
			});

			return; // EXIT
		}
		validateOwnerSellerPost(req, body, callback)
		validateService(req.user, body, callback)
	}

	const validateService = function(user, body, callback) {
        // service as a bundle is not supported
        if (body.isBundle) {
            return callback({
                status: 422,
                message: 'Service bundles are not supported'
            });
        }
		storeClient.validateService(body, user, callback);
    }

	const validateOwnerSellerPost = function(req, body, callback) {
		if (!tmfUtils.hasPartyRole(req, body.relatedParty, 'owner') || !utils.hasRole(req.user, config.oauth2.roles.seller)) {
			callback({
				status: 403,
				message: 'Unauthorized to create non-owned/non-seller service specs'
			});
		}
	};

	const validators = {
		GET: [validateRetrieving],
		POST: [utils.validateLoggedIn, validateCreation],
		PATCH: [utils.validateLoggedIn, validateOwnerSeller],
		PUT: [utils.methodNotAllowed],
		DELETE: [utils.methodNotAllowed]
	};

	const checkPermissions = function(req, callback) {
		const reqValidators = [];

		for (let i in validators[req.method]) {
			reqValidators.push(validators[req.method][i].bind(this, req));
		}

		async.series(reqValidators, callback);
	};

	const executePostValidation = function(req, callback) {
		if (req.method == 'POST' && servicePattern.test(req.apiUrl)) {
            body = req.body;
            storeClient.attachService(
                body,
                req.user,
                callback
            );
        } else {
			callback(null);
		}
	};

	const handleAPIError = function(req, callback) {
		if (servicePattern.test(req.apiUrl) && req.method == 'POST') {
            var body = JSON.parse(req.reqBody);

            // Notify the error to the charging backend to remove tha asset
            storeClient.rollbackService(body, req.user, () => {
                // No matter rollback status, return API message
                callback(null);
            });
        } else if (servicePattern.test(req.apiUrl) && req.method == 'PATCH') {
			// TODO: Configurar patch
            callback(null);
        } else {
            callback(null);
        }
	};

	return {
		checkPermissions: checkPermissions,
		executePostValidation: executePostValidation,
		handleAPIError: handleAPIError
	}
})();

exports.serviceCatalog = serviceCatalog;
