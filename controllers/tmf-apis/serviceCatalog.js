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
const uuidv4 = require('uuid').v4;
const equal = require('deep-equal')
const serviceCatalog = (function() {
	const servicesPattern = new RegExp('/serviceSpecification/?$');
	const singleServicePattern = new RegExp('/serviceSpecification/[^/]+/?$');
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
			if (!!err.response){
				callback({
					status: err.response.status
				});
			}
			else{
				callback({
					status: err.status
				});
			}
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

	const validateCreation = function(req, callback){
		if (servicesPattern.test(req.apiUrl)){

			let body = req.parsedBody
			async.series([
				function(callback){
					validateOwnerSellerPost(req, body, callback)
				},
				function(callback){
					validateService(req, body, callback)
				}
				], callback)
		}
	}

	const add_id_char = function(body, id){
		
		body["specCharacteristic"].push(
			{
				id: `urn:ngsi-ld:characteristic:${uuidv4()}`,
				name: "Asset",
				description: "ID of the asset being offered as registered in the BAE",
				valueType: "string",
				configurable: false,
				characteristicValueSpecification: [
					{
						isDefault: true,
						unitOfMeasure: "",
						value: id,
						valueFrom: "",
						valueTo: ""
					}
				]
			}
		)
		
	}

	const validateService = function(req, body, callback) {
        // service as a bundle is not supported
        if (body.isBundle) {
            return callback({
                status: 422,
                message: 'Service bundles are not supported'
            });
        }
		storeClient.validateService(body, req.user, function (err, response){
			if (err)
				callback(err)
			else{
				if(response.body.id){
					add_id_char(body, response.body.id)
					req.body = JSON.stringify(body)
					req.headers['content-length']=undefined
				}
				callback(null)
			}

		});
    }

	const validateOwnerSellerPost = function(req, body, callback) {
		if (!tmfUtils.hasPartyRole(req, body.relatedParty, 'owner') || !utils.hasRole(req.user, config.oauth2.roles.seller)) {
			return callback({
				status: 403,
				message: 'Unauthorized to create non-owned/non-seller service specs'
			});
		}
		callback(null)
	};

	const validateOwnerSeller = function(req, body, callback) {
		if (!tmfUtils.hasPartyRole(req, body.relatedParty, 'owner') || !utils.hasRole(req.user, config.oauth2.roles.seller)) {
			return callback({
				status: 403,
				message: 'Unauthorized to update non-owned/non-seller services'
			});
		}
		callback(null)
	};

	const validateServiceUpdate = function(req, prevBody, newBody, callback){
		if (tmfUtils.hasDigitalAsset(prevBody.specCharacteristic)){
			if (
				!!newBody.version &&
                !tmfUtils.hasDigitalAsset(newBody.specCharacteristic) &&
                newBody.version != prevBody.version
            ) {
                // Trying to upgrade the service without providing new asset info
                return callback({
                    status: 422,
                    message: 'To upgrade service specifications it is required to provide a valid asset info'
                });
            }

			if (
                (!!newBody.version && newBody.version == prevBody.version) ||
                (typeof newBody.version === 'undefined' &&
                    !!newBody.specCharacteristic &&
                    !equal(newBody.specCharacteristic, prevBody.specCharacteristic))
            ) {
                return callback({
                    status: 422,
                    message: 'Service specification characteristics only can be updated for upgrading digital assets'
                });
            }

			if (
                !!newBody.version &&
                newBody.version != prevBody.version &&
                tmfUtils.hasDigitalAsset(newBody.specCharacteristic) &&
                !tmfUtils.equalCustomCharacteristics(
                    newBody.specCharacteristic,
                    prevBody.specCharacteristic
                )
            ) {
                return callback({
                    status: 422,
                    message: 'It is not allowed to update custom characteristics during a service upgrade'
                });
            }

			if(!newBody.version && tmfUtils.hasDigitalAsset(newBody.specCharacteristic)){
				return callback({
					status: 403,
					message: 'Digital service spec must include the version'
				})
			}

			if (!!newBody.version && newBody.version != prevBody.version && !!newBody.specCharacteristic) {
				return storeClient.upgradeService(
                    {
                        id: prevBody.id,
                        version: newBody.version,
                        specCharacteristic: newBody.specCharacteristic
                    },
                    req.user,
                    callback
                );
            }

		}
		return callback(null)
	}

	const validateUpdate = function(req, callback){

		if(singleServicePattern.test(req.apiUrl)){
			const body = req.parsedBody
			const prevBody = req.prevBody
			if (body.lifecycleStatus != null && !tmfUtils.isValidStatusTransition(prevBody.lifecycleStatus, body.lifecycleStatus)) {
				// The status is being updated
				return callback({
					status: 400,
					message: `Cannot transition from lifecycle status ${prevBody.lifecycleStatus} to ${body.lifecycleStatus}`
				})
			}
			if (body.isBundle) {
				return callback({
					status: 422,
					message: 'Service bundles are not supported'
				});
			}
			let parts = req.apiUrl.split('/')
			const url = `/serviceSpecification/${parts[parts.length - 1]}`
			//
			// Catalog stuff should include a validFor field
			if (body && !prevBody.validFor && !body.validFor) {
				body.validFor = {
					startDateTime: new Date().toISOString()
				};
				utils.updateBody(req, body);
			}
			async.series([
				function(callback){
					validateOwnerSeller(req, prevBody, callback)
				},
				function(callback){
					validateServiceUpdate(req, prevBody, body, callback)
				}
				], callback)
		} else {
			callback({
				status: 403,
				message: 'It is not allowed to update a list'

			})
		}


	}

	const validators = {
		GET: [validateRetrieving],
		POST: [utils.validateLoggedIn, parseBody, validateCreation],
		PATCH: [utils.validateLoggedIn,parseBody, getPrevVersion, validateUpdate],
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
		if (req.method == 'POST' && servicesPattern.test(req.apiUrl)) {
            storeClient.attachService(
                req.body,
                req.user,
                callback
            );
        }
		else if(req.method == 'PATCH' && singleServicePattern.test(req.apiUrl)){
			storeClient.attachUpgradedService(req.body, req.user, callback)
		}
		else {
			callback(null);
		}
	};

	const handleAPIError = function(req, callback) {
		if (servicesPattern.test(req.apiUrl) && req.method == 'POST') {
            var body = JSON.parse(req.reqBody);

            // Notify the error to the charging backend to remove tha asset
            storeClient.rollbackService(body, req.user, () => {
                // No matter rollback status, return API message
                callback(null);
            });
        } else if (servicesPattern.test(req.apiUrl) && req.method == 'PATCH') {
			var body = JSON.parse(req.reqBody);
            handleUpgradePostAction(req, body, storeClient.rollbackServiceUpgrade, callback);
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
