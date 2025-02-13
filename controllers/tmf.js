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

const config = require('./../config')

// TMF APIs
const catalog = require('./tmf-apis/catalog').catalog
const inventory = require('./tmf-apis/inventory').inventory
const serviceInventory = require('./tmf-apis/serviceInventory').serviceInventory
const resourceInventory = require('./tmf-apis/resourceInventory').resourceInventory
const ordering = require('./tmf-apis/ordering').ordering
const charging = require('./tmf-apis/charging').charging
const rss = require('./tmf-apis/rss').rss
const party = require('./tmf-apis/party').party
const usageManagement = require('./tmf-apis/usageManagement').usageManagement
const account = require('./tmf-apis/account').account
const customer = require('./tmf-apis/customer').customer
const serviceCatalog = require('./tmf-apis/serviceCatalog').serviceCatalog
const resource = require('./tmf-apis/resource').resource

// Other dependencies
const logger = require('./../lib/logger').logger.getLogger('TMF')
const axios = require('axios')
const utils = require('./../lib/utils')

function tmf() {
	const apiControllers = {};
	apiControllers[config.endpoints.catalog.path] = catalog;
	apiControllers[config.endpoints.ordering.path] = ordering;
	apiControllers[config.endpoints.inventory.path] = inventory;
	apiControllers[config.endpoints.serviceInventory.path] = serviceInventory;
	apiControllers[config.endpoints.resourceInventory.path] = resourceInventory;
	apiControllers[config.endpoints.charging.path] = charging;
	apiControllers[config.endpoints.rss.path] = rss;
	apiControllers[config.endpoints.party.path] = party;
	apiControllers[config.endpoints.usage.path] = usageManagement;
	apiControllers[config.endpoints.account.path] = account;
	apiControllers[config.endpoints.customer.path] = customer;
	apiControllers[config.endpoints.service.path] = serviceCatalog;
	apiControllers[config.endpoints.resource.path] = resource;

	const newApis = ['party', 'catalog', 'ordering', 'inventory', 'service', 'resource', 'account', 'serviceInventory', 'resourceInventory', 'usage']

	const getAPIName = function(apiUrl) {
		return apiUrl.split('/')[1];
	};

	const sendError = function(res, err) {
		const status = err.status;
		const errMsg = err.message;

		res.status(status);
		res.json({ error: errMsg });
		res.end();
	};

	const redirectRequest = function(req, res) {
		let url;
		const api = getAPIName(req.apiUrl);
		console.log("redirectRequest")
		console.log(api)
		if (req.user) {
			utils.attachUserHeaders(req.headers, req.user);
		}

		if (newApis.indexOf(api) >= 0) {
			url = utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + req.apiUrl.replace(`/${api}`, '');
		} else {
			url = utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + req.apiUrl;
		}

		// TODO: provide a general feature for rewriting paths
		if (api == 'rss') {
			url = url.replace('rss', 'charging')
		}

		const options = {
			url: url,
			method: req.method,
			headers: utils.proxiedRequestHeaders(req)
		};

		if (typeof req.body === 'string') {
			options.data = req.body;
		}

		if (url.indexOf('/media/') >= 0) {
			options.responseType = 'arraybuffer'

			// Dissable default browser cache headers
			delete options.headers['if-modified-since'];
			delete options.headers['if-none-match'];

			options.headers['cache-control'] = 'no-cache';
		}

		console.log("proxy request")
		console.log(options)
		// PROXY THE REQUEST
		axios.request(options).then((response) => {
			console.log("axios response")
			const completeRequest = function(resp) {
				res.status(resp.status);

				for (let header in resp.headers) {
					res.setHeader(header, resp.headers[header]);
				}

				if (resp.headers['content-type'].toLowerCase().indexOf('application/json') >= 0 || resp.headers['content-type'].toLowerCase().indexOf('application/ld+json') >= 0) {
					res.json(resp.body)
				} else {
					res.write(resp.body);
					res.end();
				}
			};

			const result = {
				status: response.status,
				headers: response.headers,
				hostname: req.hostname,
				secure: req.secure,
				body: response.data,
				user: req.user,
				method: req.method,
				url: req.url,
				id: req.id,
				apiUrl: req.apiUrl,
				connection: req.connection,
				reqBody: req.body,
				query: req.query
			};

			const header = req.get('X-Terms-Accepted');

			if (result.user != null && header != null) {
				result.user.agreedOnTerms = header.toLowerCase() === 'true';
			}

			const handleValidation = (err) => {
				const basicLogMessage = 'Post-Validation (' + api + '): ';

				if (err) {
					utils.log(logger, 'warn', req, basicLogMessage + err.message);
					res.status(err.status).json({ error: err.message });
				} else {
					utils.log(logger, 'info', req, basicLogMessage + 'OK');
					completeRequest(result);
				}
			}

			if (response.status < 400 && apiControllers[api] !== undefined
				&& apiControllers[api].executePostValidation) {

				apiControllers[api].executePostValidation(result, handleValidation)

			} else if (response.status >= 400 && apiControllers[api] !== undefined
				&& apiControllers[api].handleAPIError) {

				utils.log(logger, 'warn', req, 'Handling API error (' + api + ')');
				apiControllers[api].handleAPIError(result, handleValidation)
			} else {
				completeRequest(result);
			}
		}).catch((err) => {
			console.log(err)
			utils.log(logger, 'error', req, 'Proxy error: ' + err.message);

			if (err.response) {
                res.status(err.response.status).json(err.response.data)
            } else {
                res.status(504).json({ error: 'Service unreachable' })
            }
		})
	};

	const checkPermissions = function(req, res) {
		const api = getAPIName(req.apiUrl);

		if (apiControllers[api] === undefined) {
			utils.log(logger, 'warn', req, 'API ' + api + ' not defined');

			sendError(res, {
				status: 404,
				message: 'Path not found'
			});
		} else {
			apiControllers[api].checkPermissions(req, function(err) {
				const basicLogMessage = 'Pre-Validation (' + api + '): ';
				console.log("sssss4")
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
