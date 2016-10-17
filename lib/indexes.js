/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
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

var searchIndex = require("search-index"),
    deepcopy = require("deepcopy"),
    itertools = require("aureooms-js-itertools"),
    Promise = require("promiz"),
    md5 = require("blueimp-md5"),
    leftPad = require("left-pad"),
    request = require("request"),
    config = require("../config"),
    utils = require("./utils"),
    AsyncLock = require("async-lock");

var lock = new AsyncLock({ timeout: 5000 });

exports.siTables = {
    offerings: "indexes/offerings",
    products: "indexes/products",
    catalogs: "indexes/catalogs",
    inventory: "indexes/inventory",
    orders: "indexes/orders"
};

var innerSearchIndex = function innerSearchIndex(path, method, p) {
    searchIndex({ indexPath: path }, function (err, si) {
        if (err) {
            // console.log("Error creating/opening index: " + path);
            p.reject(err);
            return;
        }

        method(si, function (err, extra) {
            si.close(function (error) {
                if (err || error) {
                    p.reject(err || error);
                } else {
                    p.resolve(extra);
                }
            });
        });
    });
};

var safeIndexExecute = function safeIndexExecute(path, method) {
    var p = new Promise();

    lock.acquire("searchIndex", function () {
        innerSearchIndex(path, method, p);
        return p;
    });

    return p;
};

exports.saveIndex = function saveIndex(path, batchdata, opt) {
    return safeIndexExecute(path, function (si, cb) {
        si.add(batchdata, opt, function (adderr) {
            cb(adderr);
        });
    });
};

exports.removeIndex = function removeIndex(path, key) {
    return safeIndexExecute(path, function (si, cb) {
        si.del(key, function (err) {
            cb(err);
        });
    });
};

// SEARCH

exports.createQuery = function createQuery(query, offset, size, sort) {
    var q = {};
    if (query)
        q.query = query;
    if (offset)
        q.offset = offset;
    if (typeof size !== "undefined" && size !== null)
        q.pageSize = size;
    if (sort)
        q.sort = sort;
    return q;
};

exports.search = function search(path, query) {
    return safeIndexExecute(path, function (si, cb) {
        var q = query;

        if (!q.query) {
            q = { query: query };
        }

        si.search(q, function (err, results) {
            if (err) {
                cb(err);
                return;
            }

            cb(null, results);
        });
    });
};

exports.searchOfferings = exports.search.bind(null, exports.siTables.offerings);

exports.searchProducts = exports.search.bind(null, exports.siTables.products);

exports.searchCatalogs = exports.search.bind(null, exports.siTables.catalogs);

exports.searchInventory = exports.search.bind(null, exports.siTables.inventory);

exports.searchOrders = exports.search.bind(null, exports.siTables.orders);

var searchId = function searchId(f, pref, id) {
    return f({ AND: { id: [pref + ":" + id] } });
};

exports.searchOfferingId = searchId.bind(null, exports.searchOfferings, "offering");

exports.searchProductId = searchId.bind(null, exports.searchProducts, "product");

exports.searchUserId = function searchUserId(f, id, offset, size, sort) {
    var q = exports.createQuery({ AND: { userId: [exports.fixUserId(id)] } }, offset, size, sort);
    return f(q);
};

var indexCreateData = function indexCreateData(keys, data, newData) {
    newData = newData || {};
    keys.forEach(key => {
        if (typeof data[key] !== "undefined" && data[key] !== null) {
            newData[key] = data[key];
        }
    });

    return newData;
};

var getUserFromOffer = function getUserFromOffer(id, def) {
    if (!!def) {
        return Promise.resolve(def);
    }

    id = (typeof id === "string") ? id.replace(/^0+/, "") : id;
    return exports.searchProductId(id)
        .then(results => (results.hits.length > 0 && results.hits[0].document.relatedParty.length > 0) ? { id: results.hits[0].document.relatedParty[0] } : {})
        .catch(() => Promise.resolve({}));
};

exports.fixUserId = function fixUserId(id) {
    return md5(id);
};

exports.convertInventoryData = function convertInventoryData(data) {
    var initialData = { id: "inventory:" + data.id,
                        originalId: data.id,
                        sortedId: leftPad(data.id, 12, 0),
                        productOffering: data.productOffering.id,
                        relatedPartyHash: data.relatedParty.map(x => exports.fixUserId(x.id)),
                        relatedParty: data.relatedParty.map(x => x.id)
                      };

    return indexCreateData(["href", "name", "status", "startDate", "orderDate", "terminationDate"], data, initialData);
};

exports.saveIndexInventory = function saveIndexInventory(data) {
    var newData = data.map(exports.convertInventoryData);

    var ops = {};

    return exports.saveIndex(exports.siTables.inventory, newData, ops);
};

exports.convertCatalogData = function convertCatalogData(data) {
    var initialData = { id: "catalog:" + data.id,
                        originalId: data.id,
                        sortedId: leftPad(data.id, 12, 0),
                        relatedPartyHash: data.relatedParty.map(x => exports.fixUserId(x.id)),
                        relatedParty: data.relatedParty.map(x => x.id)
                      };

    return indexCreateData(["href", "name", "lifecycleStatus"], data, initialData);
};

exports.saveIndexCatalog = function saveIndexCatalog(data) {
    var newData = data.map(exports.convertCatalogData);

    var ops = {};

    return exports.saveIndex(exports.siTables.catalogs, newData, ops);
};

exports.convertProductData = function convertProductData(data) {
    var searchable = [data.name, data.brand];

    var initialData = { id: "product:" + data.id,
                        originalId: data.id,
			            sortedId: leftPad(data.id, 12, 0),
                        body: searchable,
                        relatedPartyHash: data.relatedParty.map(x => exports.fixUserId(x.id)),
                        relatedParty: data.relatedParty.map(x => x.id)
                      };

    return indexCreateData(["href", "lifecycleStatus", "isBundle", "productNumber"], data, initialData);
};

exports.saveIndexProduct = function saveIndexProduct(data) {
    var newData = data.map(exports.convertProductData);

    var ops = {
        fieldOptions: [
            { fieldName: "body",
              filter: true },
            { fieldName: "relatedParty",
              filter: true }]
    };

    return exports.saveIndex(exports.siTables.products, newData, ops);
};

var blockPromises = function blockPromises(data, f) {
    var p = Promise.resolve([]);
    data.forEach(x =>
                 p = p.then(arr => f(x).then(newD => arr.concat([newD])))
                );
    return p;
};

var createUrl = function createUrl(api, extra) {
    return (config.appSsl ? "https" : "http") + "://" + utils.getAPIHost(api) + ":" + utils.getAPIPort(api) + extra;
};

var convertOffer = function convertOffer(data, user) {
    data.productSpecification = data.productSpecification || {};

    var searchable = [data.name, data.description];
    var initialData = { id: "offering:" + data.id,
                        originalId: data.id,
                        sortedId: leftPad(data.id, 12, 0),
                        body: searchable,
                        userId: exports.fixUserId(user.id),
                        productSpecification: (typeof data.productSpecification.id !== "undefined") ? leftPad(data.productSpecification.id, 12, 0) : undefined };

    if (!!data.category && data.category.length > 0) {
        return blockPromises(data.category, cat => {
            var p = new Promise();

            var url = createUrl("DSProductCatalog", "/DSProductCatalog/api/catalogManagement/v2/category/" + cat.id);

            request(url, function (err, response, body) {
                if (err) {
                    p.reject(err);
                } else {
                    var data = JSON.parse(body);
                    p.resolve({ id: data.id, name: data.name });
                }
            });

            return p;
        }).then(categories => {
            initialData.categoriesId = categories.map(x => x.id);
            initialData.categoriesName = categories.map(x => x.name);
            return indexCreateData(["href", "name", "lifecycleStatus", "isBundle"], data, initialData);
        });
    }

    var newData = indexCreateData(["href", "name", "lifecycleStatus", "isBundle"], data, initialData);

    return Promise.resolve(newData);
};

var convertNotBundle = function convertNotBundle(data, user) {
    return getUserFromOffer(data.productSpecification.id, user)
        .then(user => convertOffer(data, user));
};

var convertBundle = function convertBundle(data, user) {
    if (!!user) {
        return convertOffer(data, user);
    } else {
        return exports.searchOfferingId(data.bundledProductOffering[0].id)
            .then(offer => getUserFromOffer(offer.hits[0].document.productSpecification, user))
            .then(user => convertOffer(data, user));
    }
};

exports.convertOfferingData = function convertOfferingData(data, user) {
    if (!data.isBundle) {
        return convertNotBundle(data, user);
    } else {
        return convertBundle(data, user);
    }
};

var blockConvert = function blockConvert(data, user) {
    return blockPromises(data, x => exports.convertOfferingData(x, user));
};

exports.saveIndexOffering = function saveIndexOffering(data, user) {
    var notBundle = data.filter(x => !x.isBundle);
    var bundle = data.filter(x => x.isBundle);

    var ops = {
        fieldOptions: [
            { fieldName: "body", filter: true }
        ]
    };

    return blockConvert(notBundle, user)
        .then(newData => (newData.length > 0) ? exports.saveIndex(exports.siTables.offerings, newData, ops) : Promise.resolve())
        .then(() => blockConvert(bundle, user))
        .then(newData => (newData.length > 0) ? exports.saveIndex(exports.siTables.offerings, newData, ops) : Promise.resolve());
};

exports.convertOrderData = function convertOrderData(data) {
    var initialData = {
        id: "order:" + data.id,
        originalId: data.id,
        sortedId: leftPad(data.id, 12, 0),
        relatedPartyHash: data.relatedParty.map(x => exports.fixUserId(x.id)),
        relatedParty: data.relatedParty.map(x => x.id)
    };

    return indexCreateData(["href", "priority", "category", "state", "notificationContact", "note"], data, initialData);
};

exports.saveIndexOrder = function saveIndexOrder(data) {
    var newData = data.map(exports.convertOrderData);

    var ops = {};

    return exports.saveIndex(exports.siTables.orders, newData, ops);
};

// Request helpers!

exports.getMiddleware = function getMiddleware(reg, createOfferF, searchF, req) {
    if (req.method == "GET" && reg.test(req.apiUrl) && (typeof req.query.id === "undefined")) {
        var q = createOfferF(req);

        // If query is empty or none of the queries have AND and OR, means that there wasn't any filtering parameter, so query for all
        if (q.query.length <= 0 || itertools.all(q.query.map(x => (!!x.AND && x.AND.length === 0) || (!!x.OR && x.OR.length === 0)))) {
            q.query = { AND: [{  "*": ["*"] }]};
        }

        return searchF(q)
            .then(results => {

                var newUrl = req._parsedUrl.pathname + "?id=" + results.hits.map(r => r.document.originalId).join(",");

                for (var key in req.query) {
                    if ("action" == key && req.query[key] == 'count') {
                        newUrl = '/' + config.endpoints.management.path + '/count/' + results.hits.length;
                        break;

                    } else if (["depth", "fields"].indexOf(key) >= 0) {
                        newUrl = newUrl + "&" + key + "=" + req.query[key];
                    }
                }

                req.apiUrl = newUrl;
            });
    } else {
        return Promise.resolve();
    }
};

var createInitialQuery = function createInitialQuery(req) {
    var result = { sort: ["sortedId", "asc"] };

    if (typeof req.query.offset !== "undefined"  && typeof req.query.size !== "undefined") {
        result.offset = req.query.offset;
        result.pageSize = req.query.size;
    }

    return result;
};

exports.addOrCondition = function addOrCondition(query, name, conds) {
    if (typeof query.OR === "undefined") {
        query.OR = [];
    }

    query.OR.push(conds.map(c => ({ [name]: [c] })));
};

exports.addAndCondition = function addAndCondition(query, cond) {
    if (typeof query.AND === "undefined") {
        query.AND = [];
    }

    query.AND.push(cond);
};

// Do the product of OR possibilities and create an AND condition with every combination
exports.transformQuery = function transformQuery(query) {
    var q = [];
    var qand = { AND: [] };
    query.AND.forEach(a => qand.AND.push(deepcopy(a)));
    for (var qs of itertools.product(query.OR)) {
        var orq = deepcopy(qand);
        qs.forEach(qsi => orq.AND.push(deepcopy(qsi)));
        q.push(orq);
    };

    return q;
};

exports.genericCreateQuery = function genericCreateQuery(extras, name, f, req) {
    var q = createInitialQuery(req);
    var query = { AND: [], OR: [] };
    f = f || function () {};

    f(req, query);

    extras.forEach(key => {
        if (typeof req.query[key] !== "undefined") {
            var newq = {};
            newq[key] = [req.query[key]];
            if (typeof newq[key][0] === "string") {
                newq[key][0] = newq[key][0].toLowerCase();
            }

            exports.addAndCondition(query, newq);
        }
    });

    q.query = exports.transformQuery(query);
    return q;
};
