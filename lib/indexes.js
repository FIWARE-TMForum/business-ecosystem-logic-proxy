/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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
    level = require("levelup"),
    down = require("leveldown"),
    request = require("request"),
    Readable = require('stream').Readable,
    config = require("../config"),
    utils = require("./utils"),
    AsyncLock = require("async-lock"),
    logger = require('./logger').logger.getLogger('TMF');

var lock = new AsyncLock({ timeout: 5000 });

exports.siTables = {
    offerings: "indexes/offerings",
    products: "indexes/products",
    catalogs: "indexes/catalogs",
    inventory: "indexes/inventory",
    orders: "indexes/orders"
};

// Create databases connections
var indexDataStores = {};

var buildIndex = function (key, db, promise) {
    searchIndex({indexes:  db}, function (err, si) {
        if (err) {
            promise.reject(err);
            return;
        }
        indexDataStores[key] = si;
        promise.resolve();
    });
};

var processIndexes = function (method) {
    var indexP = Promise.resolve();
    var indexes = ['offerings', 'products', 'catalogs', 'inventory', 'orders'];

    indexes.forEach(function (key) {
        indexP = indexP.then(method.bind(this, key));
    });

    return indexP;
};

exports.init = function () {
    var createIndexConnection = function (key) {
        var p = new Promise();

        level(exports.siTables[key], {
            valueEncoding: 'json',
            db: down
        }, (err, db) => {
            if (err) {
                p.reject();
            } else {
                // Save built connection
                buildIndex(key, db, p);
            }
        });
        return p;
    };

    return processIndexes(createIndexConnection);
};

exports.close = function () {
    var closeIndexConnection = function (key) {
        var p = new Promise();
        indexDataStores[key].close(function (err) {
            if (err) {
                p.reject(err);
            } else {
                p.resolve()
            }
        });
        return p;
    };

    return processIndexes(closeIndexConnection);
};

var innerSearchIndex = function innerSearchIndex(indexName, method, p) {
    var si = indexDataStores[indexName];

    if (!si) {
        p.reject('There is not a search index for the given path');
    } else {
        method(si, function (err, extra) {
            if (err) {
                p.reject(err);
            } else {
                p.resolve(extra);
            }
        });
    }
};

var safeIndexExecute = function safeIndexExecute(path, method) {
    var p = new Promise();

    lock.acquire("searchIndex", function () {
        innerSearchIndex(path, method, p);
        return p;
    });

    return p;
};

var queryIndexExecute = function queryIndexExecute(path, method) {
    var p = new Promise();

    lock.acquire("searchIndex", (done) => done(null), function () {
        // Lock released, no need for locking reads
        innerSearchIndex(path, method, p);
    });

    return p;
};

var saveIndex = function saveIndex(path, batchdata, opt) {
    return safeIndexExecute(path, function (si, cb) {

        const dataStream = new Readable({ objectMode: true });

        batchdata.forEach((data) => {
            dataStream.push(data)
        });
        dataStream.push(null);

        dataStream
            .pipe(si.defaultPipeline(opt))
            .pipe(si.add())
            .on('data', () => {})
            .on('end', () => cb(null))
            .on('error', (err) => cb(err));
    });
};

exports.removeIndex = function removeIndex(path, key) {
    return safeIndexExecute(path, function (si, cb) {
        si.del([key], function (err) {
            cb(err);
        });
    });
};

// SEARCH

var search = function search(path, query) {
    return queryIndexExecute(path, function (si, cb) {
        var q = query;
        var results = [];

        if (!q.query) {
            q = { query: query };
        }

        si.search(q)
            .on('data', (result) => results.push(result))
            .on('error', (err) => cb(err))
            .on('end', () => cb(null, results));
    });
};

exports.searchOfferings = search.bind(null, 'offerings');

exports.searchProducts = search.bind(null, 'products');

exports.searchCatalogs = search.bind(null, 'catalogs');

exports.searchInventory = search.bind(null, 'inventory');

exports.searchOrders = search.bind(null, 'orders');

var searchId = function searchId(f, id) {
    return f({ AND: { sortedId: [leftPad(id, 12, 0)] } });
};

exports.searchOfferingId = searchId.bind(null, exports.searchOfferings);

exports.searchProductId = searchId.bind(null, exports.searchProducts);

var indexCreateData = function indexCreateData(keys, data, newData) {
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
        .then(results => {
            if (results.length > 0 && results[0].document.relatedParty.length > 0) {
                return Promise.resolve({ id: results[0].document.relatedParty[0] });
            }
            return Promise.reject('The specified product id is not indexed');
        });
};

exports.fixUserId = function fixUserId(id) {
    return md5(id);
};

var convertInventoryData = function convertInventoryData(data) {
    var initialData = { id: "inventory:" + data.id,
                        originalId: data.id,
                        body: data.searchable,
                        sortedId: leftPad(data.id, 12, 0),
                        productOffering: data.productOffering.id,
                        relatedPartyHash: data.relatedParty.filter(user => user.role.toLowerCase() == 'customer').map(x => exports.fixUserId(x.id)),
                        relatedParty: data.relatedParty.map(x => x.id)
                      };

    return indexCreateData(["href", "name", "status", "startDate", "orderDate", "terminationDate"], data, initialData);
};

var addOfferInformationToInventory = function addOfferInformationToInventory(data) {
    return exports.searchOfferingId(data.productOffering.id).then((results) => {
        if(results.length > 0) {
            data.searchable = results[0].document.searchable;
            return Promise.resolve(data);
        }

        return Promise.reject('The offering specified in the product is not indexed');
    });
};

exports.saveIndexInventory = function saveIndexInventory(data) {
    // Adds the searchable properties to data
    var opts = {
        status: {
            fieldOptions: {
                preserveCase: false
            }
        },
        body: {
            fieldOptions: {
                preserveCase: false
            }
        }
    };

    var promise = Promise.resolve();

    data.forEach(function(invData) {
        promise = promise.then(() => {
            return addOfferInformationToInventory(invData)
                .then((offerData) => saveIndex('inventory', [convertInventoryData(offerData)], opts));
        });
    });

    return promise;
};

var convertCatalogData = function convertCatalogData(data) {
    var description = typeof data.description !== 'undefined' ? data.description.toLowerCase() : '';
    var searchable = [data.name.toLowerCase(), description];

    var initialData = { id: "catalog:" + data.id,
                        originalId: data.id,
                        body: searchable,
                        sortedId: leftPad(data.id, 12, 0),
                        relatedPartyHash: data.relatedParty.map(x => exports.fixUserId(x.id)),
                        relatedParty: data.relatedParty.map(x => x.id)
                      };

    return indexCreateData(["href", "name", "lifecycleStatus"], data, initialData);
};

exports.saveIndexCatalog = function saveIndexCatalog(data) {
    var newData = data.map(convertCatalogData);

    var ops = {
        lifecycleStatus: {
            fieldOptions: {
                preserveCase: false
            }
        },
        body: {
            fieldOptions: {
                preserveCase: false
            }
        }
    };

    return saveIndex('catalogs', newData, ops);
};

var convertProductData = function convertProductData(data) {
    var description = typeof data.description !== 'undefined' ? data.description.toLowerCase() : '';
    var searchable = [data.name.toLowerCase(), data.brand.toLowerCase(), description];

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
    var newData = data.map(convertProductData);

    var ops = {
        lifecycleStatus: {
            fieldOptions: {
                preserveCase: false
            }
        },
        body: {
            fieldOptions: {
                preserveCase: false
            }
        }
    };

    return saveIndex('products', newData, ops);
};

var blockPromises = function blockPromises(data, f) {
    var p = Promise.resolve([]);
    data.forEach(x =>
                 p = p.then(arr => f(x).then(newD => arr.concat([newD])))
                );
    return p;
};

var createUrl = function createUrl(api, extra) {
    return utils.getAPIProtocol(api) + "://" + utils.getAPIHost(api) + ":" +
        utils.getAPIPort(api) + '/' + api + extra;
};

var convertOffer = function convertOffer(data, user) {
    data.productSpecification = data.productSpecification || {};

    var searchable = [data.name, data.description];
    var initialData = { id: "offering:" + data.id,
                        originalId: data.id,
                        sortedId: leftPad(data.id, 12, 0),
                        catalog: leftPad(data.catalog, 12, 0),
                        body: searchable,
                        userId: exports.fixUserId(user.id),
                        productSpecification: (typeof data.productSpecification.id !== "undefined") ? leftPad(data.productSpecification.id, 12, 0) : undefined };

    if (!!data.category && data.category.length > 0) {
        return blockPromises(data.category, cat => {
            var p = new Promise();

            var url = createUrl(config.endpoints.catalog.path, "/api/catalogManagement/v2/category/" + cat.id);

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
            initialData.categoriesId = categories.map(x => leftPad(x.id, 12, 0));
            initialData.categoriesName = categories.map(x => md5(x.name.toLowerCase()));
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
            .then(offer => getUserFromOffer(offer[0].document.productSpecification, user))
            .then(user => convertOffer(data, user));
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
    return blockPromises(data, x => convertOfferingData(x, user));
};

exports.saveIndexOffering = function saveIndexOffering(data, user) {
    var notBundle = data.filter(x => !x.isBundle);
    var bundle = data.filter(x => x.isBundle);

    var ops = {
        lifecycleStatus: {
            fieldOptions: {
                preserveCase: false
            }
        },
        body: {
            fieldOptions: {
                preserveCase: false
            }
        }
    };

    return blockConvert(notBundle, user)
        .then(newData => saveIndex('offerings', newData, ops))
        .then(() => blockConvert(bundle, user))
        .then(newData => saveIndex('offerings', newData, ops));
};

var convertOrderData = function convertOrderData(data) {
    var initialData = {
        id: "order:" + data.id,
        originalId: data.id,
        sortedId: leftPad(data.id, 12, 0),
        relatedPartyHash: data.relatedParty.filter(user => user.role.toLowerCase() == 'customer').map(x => exports.fixUserId(x.id)),
        sellerHash: data.relatedParty.filter(user => user.role.toLowerCase() == 'seller').map(x => exports.fixUserId(x.id)),
        relatedParty: data.relatedParty.map(x => x.id)
    };

    return indexCreateData(["href", "priority", "category", "state", "notificationContact", "note"], data, initialData);
};

exports.saveIndexOrder = function saveIndexOrder(data) {
    var newData = data.map(convertOrderData);

    var opts = {
        status: {
            fieldOptions: {
                preserveCase: false
            }
        }
    };

    return saveIndex('orders', newData, opts);
};

// Request helpers!

exports.getMiddleware = function getMiddleware(reg, createOfferF, searchF, req) {
    if (req.method == "GET" && reg.test(req.apiUrl) && (typeof req.query.id === "undefined")) {
        var q = createOfferF(req);

        // If query is empty or none of the queries have AND and OR, means that there wasn't any filtering parameter, so query for all
        if (q.query.length <= 0 || (q.query.length == 1 && Object.keys(q.query[0].AND).length <= 0)) {
            q.query = [{ AND: {  "*": ["*"] }}];
        }

        if (q.query.length == 1) q.query = q.query[0];

        return searchF(q)
            .then(results => {

                var newUrl = req._parsedUrl.pathname + "?id=" + results.map(r => r.document.originalId).join(",");

                for (var key in req.query) {
                    if ("action" == key && req.query[key] == 'count') {
                        newUrl = '/' + config.endpoints.management.path + '/count/' + results.length;
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
    var result = {
        sort: {
            field: "sortedId",
            direction: "asc"
        }
    };

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
var transformQuery = function transformQuery(query) {
    var q = [];
    var qand = { AND: {} };
    query.AND.forEach(a => qand.AND = Object.assign(qand.AND, deepcopy(a)));

    //TODO: Check whether the product is actually working
    for (var qs of itertools.product(query.OR)) {
        var orq = deepcopy(qand);
        qs.forEach(qsi => orq.AND = Object.assign(orq.AND, deepcopy(qsi)));
        q.push(orq);
    }

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

    q.query = transformQuery(query);
    return q;
};

exports.getDataStores = function getDataStores() {
    return indexDataStores;
};
