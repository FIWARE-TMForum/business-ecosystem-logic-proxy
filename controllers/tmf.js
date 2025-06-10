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
const { billing } = require('./tmf-apis/billing')

// Other dependencies
const logger = require('./../lib/logger').logger.getLogger('TMF')
const axios = require('axios')
const utils = require('./../lib/utils')
const { log } = require('async')
const { query } = require('express')

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
	apiControllers[config.endpoints.service.path] = serviceCatalog;
	apiControllers[config.endpoints.resource.path] = resource;
	apiControllers[config.endpoints.billing.path] = billing;

	const newApis = ['party', 'catalog', 'ordering', 'inventory', 'service', 'resource', 'account', 'serviceInventory', 'resourceInventory', 'usage', 'billing']

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

	// extracts the concrete resource from the path(e.g. the last part of the path)
	// f.e.:
	//   /catalog/some-id/productOffering/id -> /productOffering/id
	//   /catalog/some-id/productOffering -> /productOffering
	function getResourcePath(pathArray) {
		pathLength = pathArray.length
		pathModulo = pathLength % 2 
		switch(pathModulo) {
			case 1:
				return "/" + pathArray[pathLength-1];
			case 0: 
				return "/" + pathArray[pathLength-2] + "/" + pathArray[pathLength-1];
		}
	}

	function getCatalogIdFromPath(pathArray) {
		if(pathArray.length >= 5 && pathArray[2] == 'catalog' && pathArray[4] == 'productOffering') {
			return pathArray[3]
		}
	}

	function getCategoryIdsFromCatalog(catalogObject) {
		categoryIds = []
		if (typeof catalogObject['category'] == 'undefined') {
			return categoryIds
		}
		for(let i = 0; i < catalogObject['category'].length; i++) {
			categoryIds.push(catalogObject['category'][i]['id']);
		}
		return categoryIds
	}

	function queryToParams(query) {
		queryParts = query.split("&")
		params = [] 
		for(let i = 0; i < queryParts.length; i++) {
			params.push(queryParts[i].split("="))
		}
		return params
	}

	function buildQuery(query, categoryIds) {
		if(categoryIds.length > 0) {
			categoryQuery = categoryIds.join(",")
			if (query) {
				queryParams = queryToParams(query)
				categoryParam = queryParams.filter(qp => qp[0] == "category")
				if (typeof categoryParam == 'undefined' || categoryParam.length == 0) {
					return query + "&category=" + categoryQuery
				} else {
					queriedCategories = categoryParam[0][1].split(',')
					let idIntersection;
					if (queriedCategories.length > categoryIds.length) {
						idIntersection = queriedCategories.filter(x => categoryIds.includes(x))
					} else {
						idIntersection = categoryIds.filter(x => queriedCategories.includes(x))
					}
					queryParams.splice(queryParams.indexOf(categoryParam), 1)
					newQueryString = "category=" + idIntersection.join(",")
					for (let i = 0; i<queryParams.length; i++) {
						newQueryString = newQueryString + "&" + queryParams[i].join("=")
					}
					return newQueryString
				}				
			} else {
				return "category=" + categoryQuery
			}
		}
		return query
	}

	function buildCatalogUrl(req, categoryIds, pathArray) {
		api = "catalog"
		queryPart = ""
		if (req.apiUrl.includes("?")) {
			queryParts = req.apiUrl.split("?")
			queryPart = buildQuery(queryParts[queryParts.length-1], categoryIds)
		} else {
			queryPart = buildQuery(null, categoryIds)
		}
		if (queryPart) {
			return utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + utils.getAPIPath(api) + getResourcePath(pathArray) + "?" + queryPart
		} else {
			return utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + + utils.getAPIPath(api) + getResourcePath(pathArray)
		}
	}

	
	const handleCatalogRequests = function(req, res, api) {
		pathArray = req.path.split("/")
		catalogId = getCatalogIdFromPath(pathArray)

		logger["info"]("Handling a catalog request with ID: " + catalogId)
		if (typeof catalogId != 'undefined') {
			logger["info"]("Handling a catalog offer endpoint request")

			catalogUrl = utils.getAPIProtocol('catalog') + '://' + utils.getAPIHost('catalog') + ':' + utils.getAPIPort('catalog') + utils.getAPIPath('catalog') + '/catalog/' + catalogId

			catalog.retrieveCatalog(catalogId, (err, response) => {
				if (response.status == 200) {
					const url = buildCatalogUrl(req, getCategoryIdsFromCatalog(response.body), pathArray)
					logger["info"]("Making request with real endpoint: " + url)
					proxyRequest(req, res, api, buildOptions(req, url))
				} else {
					logger["warn"]("was not able to retrieve the catalog " + catalogId)
					return null
				}
			})
		} else {
			// This is a normal catalog api request
			logger["info"]("Handling a simple catalog API request")
			const api = 'catalog'
			const url = utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + utils.getAPIPath(api) + req.apiUrl.replace(`/${api}`, '');
			proxyRequest(req, res, api, buildOptions(req, url))
		}
	}

	const redirectRequest = function(req, res) {

		const api = getAPIName(req.apiUrl);

		if (req.user) {
			utils.attachUserHeaders(req.headers, req.user);
		}

		// remove the catalog sub-address from the path of all requests to the product-catalog api, since they are not addressed as such in TMF v4
		if (api == 'catalog') {
			handleCatalogRequests(req, res, api)
		} else {
			if (newApis.indexOf(api) >= 0) {
				url = utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + utils.getAPIPath(api) + req.apiUrl.replace(`/${api}`, '');
			} else {
				url = utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + utils.getAPIPath(api) + req.apiUrl;
			}
			if (api == 'rss') {
				url = url.replace('rss', 'charging')
			}
			proxyRequest(req, res, api, buildOptions(req, url))
		}
			
	};

	function buildOptions(req, url) {

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
