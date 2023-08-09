/* Copyright (c) 2019 CoNWeT Lab., Universidad Politécnica de Madrid
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

require("babel-polyfill");

var config = require("../config"),
	deepcopy = require("deepcopy"),
	itertools = require("aureooms-js-itertools"),
	md5 = require("blueimp-md5"),
	leftPad = require("left-pad"),
	request = require("request"),
	utils = require("./utils"),
	Promise = require("promiz"),
	logger = require('./logger').logger.getLogger('TMF'),
	indexes = require('./elastic_indexes');


exports.siTables = indexes.siTables;

exports.setClient = indexes.setClient;

exports.init = indexes.init;

exports.close = indexes.close;

exports.removeIndex = indexes.removeIndex;

var query = function query(path, query, isCount) {
	// logger.info(" ---- query (" + JSON.stringify(query) + ") ---");
	var method = isCount ? indexes.count : indexes.search;
	return method(path, query);
};

exports.searchOfferings = query.bind(null, 'offerings');
exports.searchProducts = query.bind(null, 'products');
exports.searchCatalogs = query.bind(null, 'catalogs');
exports.searchInventory = query.bind(null, 'inventory');
exports.searchOrders = query.bind(null, 'orders');

var searchId = function searchId(f, id) {
	return f({ AND: { sortedId: [leftPad(id, 12, 0)] } });
};

exports.searchOfferingId = searchId.bind(null, exports.searchOfferings);
exports.searchProductId = searchId.bind(null, exports.searchProducts);

var getUserFromOffer = function getUserFromOffer(id, def) {
	if (def) {
		return Promise.resolve(def);
	}

	id = typeof id === 'string' ? id.replace(/^0+/, '') : id;
	return exports.searchProductId(id).then((results) => {
		if (results.length > 0 && results[0].document.relatedParty.length > 0) {
			return Promise.resolve({ id: results[0].document.relatedParty[0] });
		}
		return Promise.reject('The specified product id is not indexed');
	});
};

exports.fixUserId = function fixUserId(id) {
	return md5(id);
};

var indexCreateData = function indexCreateData(keys, data, newData) {
	keys.forEach(key => {
		if (typeof data[key] !== "undefined" && data[key] !== null) {
			newData[key] = data[key];
		}
	});
	return newData;
};

var convertInventoryData = function convertInventoryData(data) {
	var lastUpdate;

	if (data.startDate) {
		lastUpdate = new Date(data.startDate).getTime();
	} else {
		lastUpdate = new Date().getTime();
	}

	var initialData = {
		id: 'inventory:' + data.id,
		originalId: data.id,
		body: data.searchable,
		sortedId: leftPad(data.id, 12, 0),
		lastUpdate: lastUpdate,
		productOffering: data.productOffering.id,
		relatedPartyHash: data.relatedParty
			.filter((user) => user.role.toLowerCase() === 'customer')
			.map((x) => exports.fixUserId(x.id)),
		relatedParty: data.relatedParty.map((x) => x.id)
	};

	return indexCreateData(['href', 'name', 'status', 'startDate', 'orderDate', 'terminationDate'], data, initialData);
};

var addOfferInformationToInventory = function addOfferInformationToInventory(data) {
	return exports.searchOfferingId(data.productOffering.id).then((results) => {
		if (results.length > 0) {
			data.searchable = results[0].document.searchable;
			return Promise.resolve(data);
		}

		return Promise.reject('The offering specified in the product is not indexed');
	});
};

exports.saveIndexInventory = function saveIndexInventory(data) {
	// Adds the searchable properties to data
	var opts = {
		fieldOptions: {
			status: {
				preserveCase: false
			},
			body: {
				preserveCase: false
			},
			lastUpdate: {
				sortable: true
			}
		}
	};

	var promise = Promise.resolve();

	data.forEach(function(invData) {
		promise = promise.then(() => {
			return addOfferInformationToInventory(invData)
				.then((offerData) => indexes.saveIndex('inventory', [convertInventoryData(offerData)], opts));
		});
	});

	return promise;
};

var catalog_ops = {
	fieldOptions: {
		lastUpdate: {
			sortable: true
		},
		name: {
			sortable: true
		},
		lifecycleStatus: {
			preserveCase: false
		},
		body: {
			preserveCase: false
		}
	}
};

var convertCatalogData = function convertCatalogData(data) {
	var description = typeof data.description !== 'undefined' ? data.description.toLowerCase() : '';
	var searchable = [data.name.toLowerCase(), description];

	var initialData = {
		id: 'catalog:' + data.id,
		originalId: data.id,
		body: searchable,
		sortedId: leftPad(data.id, 12, 0),
		lastUpdate: new Date(data.lastUpdate).getTime(),
		relatedPartyHash: data.relatedParty.map((x) => exports.fixUserId(x.id)),
		relatedParty: data.relatedParty.map((x) => x.id)
	};

	return indexCreateData(['href', 'name', 'lifecycleStatus'], data, initialData);
};

exports.saveIndexCatalog = function saveIndexCatalog(data) {
	var newData = data.map(convertCatalogData);

	return indexes.saveIndex('catalogs', newData, catalog_ops);
};

var convertProductData = function convertProductData(data) {
	var description = typeof data.description !== 'undefined' ? data.description.toLowerCase() : '';
	var searchable = [data.name.toLowerCase(), data.brand.toLowerCase(), description];

	var initialData = {
		id: 'product:' + data.id,
		originalId: data.id,
		sortedId: leftPad(data.id, 12, 0),
		body: searchable,
		lastUpdate: new Date(data.lastUpdate).getTime(),
		relatedPartyHash: data.relatedParty.map((x) => exports.fixUserId(x.id)),
		relatedParty: data.relatedParty.map((x) => x.id)
	};

	return indexCreateData(['name', 'href', 'lifecycleStatus', 'isBundle', 'productNumber'], data, initialData);
};

exports.saveIndexProduct = function saveIndexProduct(data) {
	var newData = data.map(convertProductData);

	return indexes.saveIndex('products', newData, catalog_ops);
};

var blockPromises = function blockPromises(data, f) {
	var p = Promise.resolve([]);
	data.forEach((x) => (p = p.then((arr) => f(x).then((newD) => arr.concat([newD])))));
	return p;
};

var createUrl = function createUrl(api, extra) {
	console.log('----------------------------------------')
	console.log(extra)
	console.log('----------------------------------------')
	if (api === 'DSProductCatalog') {
		return (config.endpoints.catalog.appSsl == true ? 'https://' : 'http://') + config.endpoints.catalog.host + ':' + config.endpoints.catalog.port + extra
	}
	return utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + extra;
};

var convertOffer = function convertOffer(data, user) {
	data.productSpecification = data.productSpecification || {};

	var searchable = [data.name, data.description];
	var initialData = {
		id: 'offering:' + data.id,
		originalId: data.id,
		sortedId: leftPad(data.id, 12, 0),
		catalog: leftPad(data.catalog, 12, 0),
		body: searchable,
		userId: exports.fixUserId(user.id),
		lastUpdate: new Date(data.lastUpdate).getTime(),
		isBundle: data.isBundle ? 'T' : 'F',
		productSpecification:
			typeof data.productSpecification.id !== 'undefined'
				? leftPad(data.productSpecification.id, 12, 0)
				: undefined
	};

	if (!!data.category && data.category.length > 0) {
		return blockPromises(data.category, (cat) => {
			var p = new Promise();
			var url = createUrl(config.endpoints.catalog.path, "/category/" + cat.id);

			request(url, function(err, response, body) {
				if (err || response.statusCode >= 400) {
					p.reject('One of the categories could not be indexed');
				} else {
					var data = JSON.parse(body);
					p.resolve({ id: data.id, name: data.name });
				}
			});

			return p;
		}).then((categories) => {
			initialData.categoriesId = categories.map((x) => leftPad(x.id, 12, 0));
			initialData.categoriesName = categories.map((x) => md5(x.name.toLowerCase()));
			return indexCreateData(['href', 'name', 'lifecycleStatus'], data, initialData);
		});
	}

	var newData = indexCreateData(['href', 'name', 'lifecycleStatus'], data, initialData);

	return Promise.resolve(newData);
};

var convertNotBundle = function convertNotBundle(data, user) {
	return getUserFromOffer(data.productSpecification.id, user).then((user) => convertOffer(data, user));
};

var convertBundle = function convertBundle(data, user) {
	if (user) {
		return convertOffer(data, user);
	} else {
		return exports
			.searchOfferingId(data.bundledProductOffering[0].id)
			.then((offer) => getUserFromOffer(offer[0].document.productSpecification, user))
			.then((user) => convertOffer(data, user));
	}
};

var convertOfferingData = function convertOfferingData(data, user) {
	if (!data.isBundle) {
		return convertNotBundle(data, user);
	} else {
		return convertBundle(data, user);
	}
};

var blockConvert = function blockConvert(data, user) {
	return blockPromises(data, (x) => convertOfferingData(x, user));
};

exports.saveIndexOffering = function saveIndexOffering(data, user) {
	var notBundle = data.filter((x) => !x.isBundle);
	var bundle = data.filter((x) => x.isBundle);

	return blockConvert(notBundle, user)
		.then(newData => indexes.saveIndex('offerings', newData, catalog_ops))
		.then(() => blockConvert(bundle, user))
		.then(newData => indexes.saveIndex('offerings', newData, catalog_ops));
};

var convertOrderData = function convertOrderData(data) {
	var initialData = {
		id: 'order:' + data.id,
		originalId: data.id,
		sortedId: leftPad(data.id, 12, 0),
		lastUpdate: new Date(data.orderDate).getTime(),
		relatedPartyHash: data.relatedParty
			.filter((user) => user.role.toLowerCase() === 'customer')
			.map((x) => exports.fixUserId(x.id)),
		sellerHash: data.relatedParty
			.filter((user) => user.role.toLowerCase() === 'seller')
			.map((x) => exports.fixUserId(x.id)),
		relatedParty: data.relatedParty.map((x) => x.id)
	};

	return indexCreateData(['href', 'priority', 'category', 'state', 'notificationContact', 'note'], data, initialData);
};

exports.saveIndexOrder = function saveIndexOrder(data) {
	var newData = data.map(convertOrderData);

	var opts = {
		fieldOptions: {
			lastUpdate: {
				sortable: true
			},
			status: {
				preserveCase: false
			}
		}
	};

	return indexes.saveIndex('orders', newData, opts);
};

// Request helpers!
exports.getMiddleware = function getMiddleware(reg, createOfferF, queryF, req) {
	var queryPromise = Promise.resolve();
	if (req.method == "GET" && reg.test(req.apiUrl) && (typeof req.query.id === "undefined")) {
		var q = createOfferF(req);
		var handler, isCount;

		// If query is empty or none of the queries have AND and OR, means that there wasn't any filtering parameter, so query for all
		if (q.query.length <= 0 || (q.query.length === 1 && Object.keys(q.query[0].AND).length <= 0)) {
			q.query = [{ AND: { '*': ['*'] } }];
		}

		if (q.query.length === 1) q.query = q.query[0];

		if ('action' in req.query && req.query.action === 'count') {
			isCount = true;
			handler = (count) => {
				req.apiUrl = '/' + config.endpoints.management.path + '/count/' + count;
			};
		} else {
			isCount = false;
			handler = (results) => {
				var newUrl = req._parsedUrl.pathname + '?id=' + results.map((r) => r.document.originalId).join(',');

				for (var key in req.query) {
					if (['depth', 'fields'].indexOf(key) >= 0) {
						newUrl = newUrl + '&' + key + '=' + req.query[key];
					}
				}

				req.apiUrl = newUrl;
			};
		}

		queryPromise = queryF(q, isCount).then(handler);
	}
	return queryPromise;
};

var createInitialQuery = function createInitialQuery(req) {
	var valid_sorts = {
		date: {
			field: 'lastUpdate',
			direction: 'desc'
		},
		name: {
			field: 'name',
			direction: 'asc'
		}
	};
	var result = {};
	var sorting = 'date';

	if (typeof req.query.sort !== 'undefined' && req.query.sort in valid_sorts) {
		sorting = req.query.sort;
	}

	result.sort = valid_sorts[sorting];

	if (typeof req.query.offset !== 'undefined' && typeof req.query.size !== 'undefined') {
		result.offset = req.query.offset;
		result.pageSize = req.query.size;
	}
	return result;
};

exports.addOrCondition = function addOrCondition(query, name, conds) {
	if (typeof query.OR === 'undefined') {
		query.OR = [];
	}

	query.OR.push(conds.map((c) => ({ [name]: [c] })));
};

exports.addAndCondition = function addAndCondition(query, cond) {
	if (typeof query.AND === 'undefined') {
		query.AND = [];
	}

	query.AND.push(cond);
};

// Do the product of OR possibilities and create an AND condition with every combination
var transformQuery = function transformQuery(query) {
	var q = [];
	var qand = { AND: {} };
	query.AND.forEach((a) => (qand.AND = Object.assign(qand.AND, deepcopy(a))));

	// TODO: Check whether the product is actually working
	for (var qs of itertools.product(query.OR)) {
		var orq = deepcopy(qand);
		qs.forEach((qsi) => (orq.AND = Object.assign(orq.AND, deepcopy(qsi))));
		q.push(orq);
	}
	return q;
};

exports.genericCreateQuery = function genericCreateQuery(extras, name, f, req) {
	var q = createInitialQuery(req);
	var query = { AND: [], OR: [] };
	f = f || function() { };

	f(req, query);

	extras.forEach((key) => {
		if (typeof req.query[key] !== 'undefined') {
			let newq = {};
			let value = req.query[key]

			if (key == 'isBundle') {
				value = req.query[key] == 'true' ? 'T' : 'F';
			}

			newq[key] = [value];
			if (typeof newq[key][0] === 'string') {
				newq[key][0] = newq[key][0].toLowerCase();
			}

			exports.addAndCondition(query, newq);
		}
	});

	q.query = transformQuery(query);
	return q;
};

exports.getDataStores = indexes.getDataStores;
