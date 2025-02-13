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

const serviceCatalog = (function() {

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

	const getResourceAPIUrl = function(path) {
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
						message: 'The required service does not exist'
					});
				} else {
					callback({
						status: 500,
						message: 'The required service cannot be created/updated'
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
				message: 'Unauthorized to update non-owned/non-seller services'
			});
		} else {
			callback(null)
		}
	};

	const validateOwnerSellerPost = function(req, callback) {
		const body = req.parsedBody
		if (!tmfUtils.hasPartyRole(req, body.relatedParty, 'owner') || !utils.hasRole(req.user, config.oauth2.roles.seller)) {
			callback({
				status: 403,
				message: 'Unauthorized to create non-owned/non-seller service specs'
			});
		} else {
			callback(null)
		}
	};

	const getProductSpecs = function (ref, fields, callback){
		const endpoint = config.endpoints.catalog
        const specPath = `/productSpecification?serviceSpecification.id=${ref}&fields=${fields}`
        const uri = utils.getAPIURL(
            endpoint.appSsl,
            endpoint.host,
            endpoint.port,
            specPath
        );
        axios.get(uri).then((response) => {
            callback(null, {
                status: response.status,
                body: response.data
            });

        }).catch((err) => {
            callback({
                status: err.status
            });
        })
    }

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
		if (!!prevBody.lifecycleStatus && prevBody.lifecycleStatus.toLowerCase() !== 'retired' && 
		!!body.lifecycleStatus && body.lifecycleStatus.toLowerCase() === 'retired'){
			getProductSpecs(prevBody.id, 'lifecycleStatus', function (err, response){

				if(err) {
					callback(err)
				} else {
					const data = response.body
					let allRetObs = true
					for (let prodSpec of data){
						if(prodSpec.lifecycleStatus.toLowerCase() !== 'retired' && prodSpec.lifecycleStatus.toLowerCase() !== 'obsolete'){
							allRetObs = false
							break;
						}
					}
					if(allRetObs){
						callback(null)
					}
					else {
						callback({
							status: 409,
							message: `Cannot retire a service spec without retiring all product specs linked with it`
						})
					}
				}
			})
		}
		else{
			callback(null)
		}
	}

	const validators = {
		GET: [validateRetrieving],
		POST: [utils.validateLoggedIn, parseBody, validateOwnerSellerPost],
		PATCH: [utils.validateLoggedIn, parseBody, getPrevVersion, validateUpdate, validateOwnerSeller],
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

	const executePostValidation = function(response, callback) {
        callback(null);
	};

	const handleAPIError = function(res, callback) {
		callback(null);
	};

	return {
		checkPermissions: checkPermissions,
		executePostValidation: executePostValidation,
		handleAPIError: handleAPIError
	}
})();

exports.serviceCatalog = serviceCatalog;
