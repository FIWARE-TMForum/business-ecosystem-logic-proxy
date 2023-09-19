/* Copyright (c) 2015 - 2018 CoNWeT Lab., Universidad Politécnica de Madrid
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

const config = require('./../config')

// TMF APIs
const catalog = require('./tmf-apis/catalog').catalog
const inventory = require('./tmf-apis/inventory').inventory
const ordering = require('./tmf-apis/ordering').ordering
const charging = require('./tmf-apis/charging').charging
const rss = require('./tmf-apis/rss').rss
const party = require('./tmf-apis/party').party
const usageManagement = require('./tmf-apis/usageManagement').usageManagement
const billing = require('./tmf-apis/billing').billing
const customer = require('./tmf-apis/customer').customer

// Other dependencies
const logger = require('./../lib/logger').logger.getLogger('TMF')
const request = require('request')
const utils = require('./../lib/utils')

function tmf() {
	const apiControllers = {};
	apiControllers[config.endpoints.catalog.path] = catalog;
	apiControllers[config.endpoints.ordering.path] = ordering;
	apiControllers[config.endpoints.inventory.path] = inventory;
	apiControllers[config.endpoints.charging.path] = charging;
	apiControllers[config.endpoints.rss.path] = rss;
	apiControllers[config.endpoints.party.path] = party;
	apiControllers[config.endpoints.usage.path] = usageManagement;
	apiControllers[config.endpoints.billing.path] = billing;
	apiControllers[config.endpoints.customer.path] = customer;

	const newApis = ['party']

	var getAPIName = function(apiUrl) {
		return apiUrl.split('/')[1];
	};

	var sendError = function(res, err) {
		var status = err.status;
		var errMsg = err.message;

		res.status(status);
		res.json({ error: errMsg });
		res.end();
	};

	var redirectRequest = function(req, res) {
		if (req.user) {
			utils.attachUserHeaders(req.headers, req.user);
		}
		let url;
		const api = getAPIName(req.apiUrl);
		console.log("-----------------------------------")
		console.log("-----------------------------------")

		if (newApis.indexOf(api) >= 0) {
			console.log("New API")
			url = utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + req.apiUrl.replace(`/${api}`, '');
		} else {
			console.log("OLD API")
			url = utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + req.apiUrl;
		}

		console.log(url)

		var options = {
			url: url,
			method: req.method,
			encoding: null,
			headers: utils.proxiedRequestHeaders(req)
		};

		if (typeof req.body === 'string') {
			options.body = req.body;
		}

		// PROXY THE REQUEST
		request(options, function(err, response, body) {
			var completeRequest = function(result) {
				res.status(result.status);

				for (var header in result.headers) {
					res.setHeader(header, result.headers[header]);
				}

				res.write(result.body);
				res.end();
			};

			if (err) {
				res.status(504).json({ error: 'Service unreachable' });
			} else {
				var result = {
					status: response.statusCode,
					headers: response.headers,
					hostname: req.hostname,
					secure: req.secure,
					body: body,
					user: req.user,
					method: req.method,
					url: req.url,
					id: req.id,
					apiUrl: req.apiUrl,
					connection: req.connection,
					reqBody: req.body
				};

				var header = req.get('X-Terms-Accepted');

				if (result.user != null && header != null) {
					result.user.agreedOnTerms = header.toLowerCase() === 'true';
				}

				// Execute postValidation if status code is lower than 400 and the
				// function is defined
				if (
					response.statusCode < 400 &&
					apiControllers[api] !== undefined &&
					apiControllers[api].executePostValidation
				) {
					apiControllers[api].executePostValidation(result, function(err) {
						var basicLogMessage = 'Post-Validation (' + api + '): ';

						if (err) {
							utils.log(logger, 'warn', req, basicLogMessage + err.message);
							res.status(err.status).json({ error: err.message });
						} else {
							utils.log(logger, 'info', req, basicLogMessage + 'OK');
							completeRequest(result);
						}
					});
				} else if (
					response.statusCode >= 400 &&
					apiControllers[api] !== undefined &&
					apiControllers[api].handleAPIError
				) {
					apiControllers[api].handleAPIError(result, (err) => {
						utils.log(logger, 'warn', req, 'Handling API error (' + api + ')');

						if (err) {
							res.status(err.status).json({ error: err.message });
						} else {
							completeRequest(result);
						}
					});
				} else {
					completeRequest(result);
				}
			}
		});
	};

	var checkPermissions = function(req, res) {
		var api = getAPIName(req.apiUrl);

		if (apiControllers[api] === undefined) {
			utils.log(logger, 'warn', req, 'API ' + api + ' not defined');

			sendError(res, {
				status: 404,
				message: 'Path not found'
			});
		} else {
			apiControllers[api].checkPermissions(req, function(err) {
				var basicLogMessage = 'Pre-Validation (' + api + '): ';

				if (err) {
					utils.log(logger, 'warn', req, basicLogMessage + err.message);
					sendError(res, err);
				} else {
					utils.log(logger, 'info', req, basicLogMessage + 'OK');
					redirectRequest(req, res);
				}
			});
		}
	};

	var public = function(req, res) {
		redirectRequest(req, res);
	};

	return {
		checkPermissions: checkPermissions,
		public: public
	};
}

exports.tmf = tmf;
