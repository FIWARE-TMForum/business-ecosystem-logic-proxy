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
const serviceCatalog = require('./tmf-apis/serviceCatalog').serviceCatalog
const resource = require('./tmf-apis/resource').resource
const { quote } = require('./tmf-apis/quote')
const { billing } = require('./tmf-apis/billing')
const { revenue } = require('./tmf-apis/revenue')
const { invoicing } = require('./tmf-apis/invoicing')
const { search } = require('./tmf-apis/search')
const { ai } = require('./tmf-apis/ai')

// Other dependencies
const logger = require('./../lib/logger').logger.getLogger('TMF')
const axios = require('axios')
const utils = require('./../lib/utils')
const tmfUtils = require('./../lib/tmfUtils')

const { log } = require('async')
const { query } = require('express')
const FormData = require('form-data')


function tmf() {
	const apiControllers = {};
	apiControllers[config.tmforum.catalog.path] = catalog;
	apiControllers[config.tmforum.ordering.path] = ordering;
	apiControllers[config.tmforum.inventory.path] = inventory;
	apiControllers[config.tmforum.serviceInventory.path] = serviceInventory;
	apiControllers[config.tmforum.resourceInventory.path] = resourceInventory;
	apiControllers[config.endpoints.charging.path] = charging;
	apiControllers[config.endpoints.rss.path] = rss;
	apiControllers[config.tmforum.party.path] = party;
	apiControllers[config.tmforum.usage.path] = usageManagement;
	apiControllers[config.tmforum.account.path] = account;
	apiControllers[config.tmforum.service.path] = serviceCatalog;
	apiControllers[config.tmforum.resource.path] = resource;
	apiControllers[config.tmforum.billing.path] = billing;
	apiControllers[config.endpoints.quote.path] = quote;
	apiControllers[config.endpoints.revenue.path] = revenue;
	apiControllers[config.endpoints.invoicing.path] = invoicing;
	apiControllers[config.endpoints.search.path] = search;
	apiControllers[config.endpoints.ai.path] = ai;

	const newApis = [
		config.tmforum.party.path,
		config.tmforum.catalog.path,
		config.tmforum.ordering.path,
		config.tmforum.inventory.path,
		config.tmforum.service.path,
		config.tmforum.resource.path,
		config.tmforum.account.path,
		config.tmforum.serviceInventory.path,
		config.tmforum.resourceInventory.path,
		config.tmforum.usage.path,
		config.tmforum.billing.path,
		config.endpoints.quote.path,
		config.endpoints.revenue.path,
		config.endpoints.invoicing.path,
		config.endpoints.search.path,
		config.endpoints.ai.path
	]

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

		const api = getAPIName(req.apiUrl);

		if (req.user) {
			utils.attachUserHeaders(req.headers, req.user);
		}

		if (newApis.indexOf(api) >= 0) {
			url = utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + utils.getAPIPath(api) + req.apiUrl.replace(`/${api}`, '');
		} else {
			url = utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + utils.getAPIPath(api) + req.apiUrl;
		}
		if (api == 'rss') {
			url = url.replace('rss', 'charging')
		}
		buildOptions(req, url).then((options) => {
			proxyRequest(req, res, api, options)
		})
			
	};

	async function buildOptions(req, url) {
		const api = getAPIName(req.apiUrl)

		// Attach the needed relatedParties if not provided already
		if (req.method == 'POST') {
			try {
				await tmfUtils.attachRelatedParty(req, api)
			} catch (err) {
				logger.error('Error attaching related parties: ' + err.message)
				return sendError(res, {
					status: 400,
					message: 'Error processing party information'
				});
			}
		}

		const options = {
			url: url,
			method: req.method,
			headers: utils.proxiedRequestHeaders(req)
		};

		// Keep AI HTTPS calls isolated from incoming host header and allow
		// explicit proxy bypass for AI calls.
		if (api === config.endpoints.ai.path && url.startsWith('https://')) {
			delete options.headers.host;
			options.proxy = false;
		}

		if (req.headers['content-type']?.startsWith('multipart/form-data')) {
			// Multipart requests need to be rebuild
			const form = new FormData();
			for (const [key, value] of Object.entries(req.body)) {
				form.append(key, value);
			}

			for (const file of req.files || []) {
				form.append(file.fieldname, file.buffer, {
					filename: file.originalname,
					contentType: file.mimetype,
				});
			}
			 // Replace options.data and headers
			options.data = form;
			delete options.headers['content-type'];
			delete options.headers['content-length'];

			options.headers = {
				...options.headers,
				...form.getHeaders(), // Sets multipart Content-Type with boundary
			};

			options.maxContentLength = Infinity;
			options.maxBodyLength = Infinity;
		} else {
			if (typeof req.body === 'string') {
				options.data = req.body;
			}

			if (url.indexOf('/media/') >= 0 || url.indexOf('/invoicing/') >= 0) {
				options.responseType = 'arraybuffer'

				// Dissable default browser cache headers
				delete options.headers['if-modified-since'];
				delete options.headers['if-none-match'];

				options.headers['cache-control'] = 'no-cache';
			}
		}

		return options
	}

	const proxyRequest = function(req, res, api, options) {
		// PROXY THE REQUEST
		axios.request(options).then((response) => {

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

			if (req.extraData) {
				result.extraData = req.extraData;
			}

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
	}

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
