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
		console.log("retriving asset from " + path)
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
			if (!!err.response)
				callback({
					status: err.response.status
				});
			else{
				console.log("error: " + err)
				callback({
					status: err.status
				});
			}
		})
	};

	const validateCreation = function(req, callback){
		if (servicesPattern.test(req.apiUrl)){

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
			validateService(req, body, callback)
			console.log("ssssss3")
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
		console.log("validate service body: ")
		storeClient.validateService(body, req.user, function (err, response){
			if (err)
				callback(err)
			else{
				if(response.body.id){
					add_id_char(body, response.body.id)
					req.body = JSON.stringify(body)
					req.headers['content-length']=undefined
				}
				console.log('ssssssss')
				callback(null)
				console.log('ssssssss2')
			}

		});
    }

	const validateOwnerSellerPost = function(req, body, callback) {
		if (!tmfUtils.hasPartyRole(req, body.relatedParty, 'owner') || !utils.hasRole(req.user, config.oauth2.roles.seller)) {
			callback({
				status: 403,
				message: 'Unauthorized to create non-owned/non-seller service specs'
			});
		}
	};

	const validateOwnerSeller = function(req, prevBody, callback) {
		if (!tmfUtils.hasPartyRole(req, prevBody.relatedParty, 'owner') || !utils.hasRole(req.user, config.oauth2.roles.seller)) {
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
	}

	const validateUpdate = function(req, callback){

		if(singleServicePattern.test(req.apiUrl)){
			const parsedBody = utils.emptyObject(req.body) ? null : JSON.parse(req.body);
			if (parsedBody.isBundle) {
				return callback({
					status: 422,
					message: 'Service bundles are not supported'
				});
			}
			let parts = req.apiUrl.split('/')
			const url = `/serviceSpecification/${parts[parts.length - 1]}`
			retrieveAsset(url, function(err, result){
				if(err){
					if (err.status === 404) {
						callback({
							status: 404,
							message: 'The required service does not exist'
						});
					} else {
						callback({
							status: 500,
							message: 'The required service cannot be updated'
						});
					}
				}
				else {
					const previousBody = result.body;
					//
					// Catalog stuff should include a validFor field
					if (parsedBody && !previousBody.validFor && !parsedBody.validFor) {
						parsedBody.validFor = {
							startDateTime: new Date().toISOString()
						};
						utils.updateBody(req, parsedBody);
					}
					async.series([
						function(callback){
							console.log("validateOwnerSeller")
							validateOwnerSeller(req, previousBody, callback)
						},
						function(callback){
							console.log("validateServiceUpdate")
							validateServiceUpdate(req, previousBody, parsedBody, callback)
						}
						], callback)
					

				}
			})
		} else {
			callback({
				status: 403,
				message: 'It is not allowed to update a list'

			})
		}


	}

	const validators = {
		GET: [validateRetrieving],
		POST: [utils.validateLoggedIn, validateCreation],
		PATCH: [utils.validateLoggedIn, validateUpdate],
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
		console.log("execute post validation")
		if (req.method == 'POST' && servicesPattern.test(req.apiUrl)) {
			console.log("into post validation")
			//console.log(body)
            storeClient.attachService(
                req.body,
                req.user,
                callback
            );
        }
		else if(req.method == 'PATCH' && singleServicePattern.test(req.apiUrl)){
			console.log("inside patch validation")
			storeClient.attachUpgradedService(req.body, req.user, callback)
		}
		else {
			console.log("no executePostValidation")
			console.log(req.apiUrl + "--> " + servicesPattern.test(req.apiUrl))
			console.log(req.method + "--> " + req.method == 'POST')
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
