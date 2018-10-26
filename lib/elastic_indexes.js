require("babel-polyfill");

var Promise = require("promiz"),
    request = require("request"),
    elasticsearch = require("elasticsearch"),
    config = require("../config"),
    logger = require("./logger").logger.getLogger('TMF'),
    searchIndex = require("search-index"),
    deepcopy = require("deepcopy"),
    itertools = require("aureooms-js-itertools"),
    md5 = require("blueimp-md5"),
    leftPad = require("left-pad"),
    level = require("levelup"),
    down = require("leveldown"),
    Readable = require('stream').Readable,
    utils = require("./utils"),
    AsyncLock = require("async-lock");

var lock = new AsyncLock({ timeout: 5000 });

let elasticClient = testElasticConnection();

function testElasticConnection () {
    // logger.info(" ---- testElasticConnection ----");
    let client = new elasticsearch.Client({
        hosts: config.indexes.elasticHosts,
        log: 'debug'
    });

    // test connection
    client.ping({
        // standard ping timeout
        requestTimeout: 3000
    }, function(error) {
        if(error){
            logger.info('Cannot connect to elasticsearch host!');
        } else {
            logger.info('Connected to elasticsearch (' + config.indexes.elasticHosts + ')');
        }
    });

    return client;
};

exports.elasticIndexes = {
    offerings: "offerings",
    products: "products",
    catalogs: "catalogs",
    inventory: "inventory",
    orders: "orders"
};

exports.init = function () {
    // logger.info(" ---- init ----");
    var p = new Promise();
    
    buildIndexes(Object.values(exports.elasticIndexes)).then(indexes => {
	console.log(indexes);
    }).catch(err => {
	throw new Error(err);
    });

    return p;
};

// Create databases connections
var indexDataStores = {};

var buildIndex = function (ind) {
    // logger.info(" ---- buildIndex ----");
    var p = new Promise();
    // index.forEach(i => {
    // 	elasticExists(i, 1).then(exists => {
    // 	    if(!exists) {
    // 		elasticClient.create({
    // 		    index: i,
    // 		    type: i,
    // 		    id: 1,
    // 		    body: {}
    // 		});
    // 	    }
    // 	});
    // });
    elasticExists(ind, 1).then(exists => {
	if(!exists) {
	    elasticClient.create({
		index: ind,
		type: ind,
		id: 1,
		body: {}
	    });
	}
    }).catch(err => {
	return p.reject(err);
    });
    
    return p.resolve();
};

var buildIndexes = function (indexes) {
    return Promise.all(indexes.map(buildIndex));
};

var processIndexes = function (method) {
    // logger.info(" ---- processIndexes ----");
    var indexP = Promise.resolve();
    var indexes = ['offerings', 'products', 'catalogs', 'inventory', 'orders'];

    indexes.forEach(function (key) {
        indexP = indexP.then(method.bind(this, key));
    });

    return indexP;
};

exports.close = function () {
    // logger.info(" ---- close ----");
    var closeIndexConnection = function (key) {
        var p = new Promise();
        indexDataStores[key].close(function (err) {
            if (err) {
                p.reject(err);
            } else {
                p.resolve();
            }
        });
        return p;
    };

    return processIndexes(closeIndexConnection);
};

var innerSearchIndex = function innerSearchIndex(indexName, method, p) {
    // logger.info(" ---- innerSearchIndex ----");
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
    // logger.info(" ---- safeIndexExecute ----");
    var p = new Promise();

    lock.acquire("searchIndex", function () {
        innerSearchIndex(path, method, p);
        return p;
    });

    return p;
};

var queryIndexExecute = function queryIndexExecute(method) {
    // logger.info(" ---- queryIndexExecute ----");
    var p = new Promise();

    lock.acquire("searchIndex", (done) => done(null), function () {
        // Lock released, no need for locking reads
        innerSearchIndex(path, method, p);
    });

    return p;
};

var elasticExists = function elasticExists(indexName, objectID){
    // logger.info(" ---- elasticExists ----");
    return elasticClient.exists({
        index: indexName,
        type: indexName,
        id: objectID
    });
};

var saveIndex = function saveIndex(path, batchdata, opt) {
    // logger.info(" ---- saveIndex ----");
    var p = new Promise();

    batchdata.forEach(batch => {
        batch.lifecycleStatus = batch.lifecycleStatus.toLowerCase();
        elasticExists(path, batch.originalId).then(exists => {
            if (!exists) {
                elasticClient.create({
                    index: path,
                    type: path,
                    id: batch.originalId,
                    body: batch
                }).then(function(body){},
                        function(error){
                            p.reject(error);
                        });
            } else {
                elasticClient.update({
                    index: path,
                    type: path,
                    id: batch.originalId,
                    body: { doc: batch }
                }).then(function(body) {},
                        function(error) {
                            p.reject(error);
                        });
            };
        });
    });

    return p.resolve();
};

// SEARCH

var translateSortToElastic = function translateSortToElastic(sortQuery) {
    return JSON.stringify({[sortQuery.field] : { order: sortQuery.direction}});
};

var translateANDToElastic = function translateANDToElastic(k, v) {
    return { match: {[k]: [v]}};
};

var searchElastic = function searchElastic(path, originalQuery) {
    var stringQuery = "";
    var queryFields = [];

    var p = new Promise();

    console.info("original query: " + JSON.stringify(originalQuery.query));

    Object.keys(originalQuery.query).forEach(q => {
        var key = originalQuery.query[q];
	
        if (Object.keys(key)[0] === "AND") {
            key = originalQuery.query[q]["AND"];
        }
	stringQuery = stringQuery.concat("(");
	Object.keys(key).forEach(k => {
	    stringQuery = stringQuery.concat(key[k][0] + " AND ");
	});
	
	stringQuery = stringQuery.substring(0, stringQuery.lastIndexOf(" AND ")) + ") ";
    });

    stringQuery = stringQuery.substring(0, stringQuery.lastIndexOf(" "));

    var req = {
        index: path,
        type: path,
        sort: [translateSortToElastic(originalQuery.sort)],
        from: originalQuery.offset,
        size: originalQuery.pageSize,

        body: {query: {query_string: { fields: queryFields, query: stringQuery}}}
    };

    return Promise.resolve(elasticClient.search(req));
};


var search = function search(path, originalQuery) {
    // logger.info(" ---- search ----");

    return Promise.resolve(searchElastic(path, originalQuery)).then(r => {
        return convertElasticSearch(r);
    });
};

var convertElasticSearch = function convertElasticSearch(req) {
    // logger.info(" ---- convertElasticSearch ----");
    var convertedFullReq = [];

    req.hits.hits.forEach(req => {
        convertedFullReq.push({
            id: req._source.id,
            originalId: req._source.originalId,
            score: String(req._score),
            document: req._source,
        });
    });

    return convertedFullReq;
};

var count = function count(path, query) {
    // logger.info(" ---- count ----");
    
    return Promise.resolve(searchElastic(path, query)).then( r => {
        return r.hits.total;
    });

};

var query = function query(path, query, isCount) {
    // logger.info(" ---- query (" + JSON.stringify(query) + ") ---");
    var method = isCount ? count : search;
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

var indexCreateData = function indexCreateData(keys, data, newData) {
    // logger.info(" ---- indexCreateData ----");
    keys.forEach(key => {
        if (typeof data[key] !== "undefined" && data[key] !== null) {
            newData[key] = data[key];
        }
    });
    return newData;
};

var getUserFromOffer = function getUserFromOffer(id, def) {
    // logger.info(" ---- getUserFromOffer ----");
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
    // logger.info(" ---- fixUserId ----");
    return md5(id);
};

var convertInventoryData = function convertInventoryData(data) {
    // logger.info(" ---- convertInventoryData ----");
    var lastUpdate;

    if (!!data.startDate) {
        lastUpdate = new Date(data.startDate).getTime();
    } else {
        lastUpdate = new Date().getTime();
    }

    var initialData = { id: "inventory:" + data.id,
                        originalId: data.id,
                        body: data.searchable,
                        sortedId: leftPad(data.id, 12, 0),
                        lastUpdate: lastUpdate,
                        productOffering: data.productOffering.id,
                        relatedPartyHash: data.relatedParty.filter(user => user.role.toLowerCase() == 'customer').map(x => exports.fixUserId(x.id)),
                        relatedParty: data.relatedParty.map(x => x.id)
                      };

    return indexCreateData(["href", "name", "status", "startDate", "orderDate", "terminationDate"], data, initialData);
};

var addOfferInformationToInventory = function addOfferInformationToInventory(data) {
    // logger.info(" ---- addOfferInformationToInventory ----");
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
    // logger.info(" ---- saveIndexInventory ----");
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
                .then((offerData) => saveIndex('inventory', [convertInventoryData(offerData)], opts));
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
    // logger.info(" ---- convertCatalogData ----");
    var description = typeof data.description !== 'undefined' ? data.description.toLowerCase() : '';
    var searchable = [data.name.toLowerCase(), description];
    var initialData = { id: "catalog:" + data.id,
                        originalId: data.id,
                        body: searchable,
                        sortedId: leftPad(data.id, 12, 0),
                        lastUpdate: new Date(data.lastUpdate).getTime(),
                        relatedPartyHash: data.relatedParty.map(x => exports.fixUserId(x.id)),
                        relatedParty: data.relatedParty.map(x => x.id)
                      };

    return indexCreateData(["href", "name", "lifecycleStatus"], data, initialData);
};

exports.saveIndexCatalog = function saveIndexCatalog(data) {
    // logger.info(" ---- saveIndexCatalog ----");
    var newData = data.map(convertCatalogData);

    return saveIndex('catalogs', newData, catalog_ops);
};

var convertProductData = function convertProductData(data) {
    // logger.info(" ---- convertProductData ----");
    var description = typeof data.description !== 'undefined' ? data.description.toLowerCase() : '';
    var searchable = [data.name.toLowerCase(), data.brand.toLowerCase(), description];

    var initialData = { id: "product:" + data.id,
                        originalId: data.id,
                        sortedId: leftPad(data.id, 12, 0),
                        body: searchable,
                        lastUpdate: new Date(data.lastUpdate).getTime(),
                        relatedPartyHash: data.relatedParty.map(x => exports.fixUserId(x.id)),
                        relatedParty: data.relatedParty.map(x => x.id)
                      };

    return indexCreateData(["name", "href", "lifecycleStatus", "isBundle", "productNumber"], data, initialData);
};

exports.saveIndexProduct = function saveIndexProduct(data) {
    // logger.info(" ---- saveIndexProduct ----");
    var newData = data.map(convertProductData);

    return saveIndex('products', newData, catalog_ops);
};

var blockPromises = function blockPromises(data, f) {
    // logger.info(" ---- blockPromises ----");
    var p = Promise.resolve([]);
    data.forEach(x =>
                 p = p.then(arr => f(x).then(newD => arr.concat([newD])))
                );
    return p;
};

var createUrl = function createUrl(api, extra) {
    // logger.info(" ---- createUrl ----");
    return utils.getAPIProtocol(api) + "://" + utils.getAPIHost(api) + ":" +
        utils.getAPIPort(api) + '/' + api + extra;
};

var convertOffer = function convertOffer(data, user) {
    // logger.info(" ---- convertOffer ----");
    data.productSpecification = data.productSpecification || {};

    var searchable = [data.name, data.description];
    var initialData = { id: "offering:" + data.id,
                        originalId: data.id,
                        sortedId: leftPad(data.id, 12, 0),
                        catalog: leftPad(data.catalog, 12, 0),
                        body: searchable,
                        userId: exports.fixUserId(user.id),
                        lastUpdate: new Date(data.lastUpdate).getTime(),
                        productSpecification: (typeof data.productSpecification.id !== "undefined") ? leftPad(data.productSpecification.id, 12, 0) : undefined };

    if (!!data.category && data.category.length > 0) {
        return blockPromises(data.category, cat => {
            var p = new Promise();

            var url = createUrl(config.endpoints.catalog.path, "/api/catalogManagement/v2/category/" + cat.id);

            request(url, function (err, response, body) {
                if (err || response.statusCode >= 400) {
                    p.reject('One of the categories could not be indexed');
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
    // logger.info(" ---- convertNotBundle ----");
    return getUserFromOffer(data.productSpecification.id, user)
        .then(user => convertOffer(data, user));
};

var convertBundle = function convertBundle(data, user) {
    // logger.info(" ---- convertBundle ----");
    if (!!user) {
        return convertOffer(data, user);
    } else {
        return exports.searchOfferingId(data.bundledProductOffering[0].id)
            .then(offer => getUserFromOffer(offer[0].document.productSpecification, user))
            .then(user => convertOffer(data, user));
    }
};

var convertOfferingData = function convertOfferingData(data, user) {
    // logger.info(" ---- convertOfferingData ----");
    if (!data.isBundle) {
        return convertNotBundle(data, user);
    } else {
        return convertBundle(data, user);
    }
};

var blockConvert = function blockConvert(data, user) {
    // logger.info(" ---- blockConvert ----");
    return blockPromises(data, x => convertOfferingData(x, user));
};

exports.saveIndexOffering = function saveIndexOffering(data, user) {
    // logger.info(" ---- saveIndexOffering ----");
    var notBundle = data.filter(x => !x.isBundle);
    var bundle = data.filter(x => x.isBundle);

    return blockConvert(notBundle, user)
        .then(newData => saveIndex('offerings', newData, catalog_ops))
        .then(() => blockConvert(bundle, user))
        .then(newData => saveIndex('offerings', newData, catalog_ops));
};

var convertOrderData = function convertOrderData(data) {
    // logger.info(" ---- convertOrderData ----");
    var initialData = {
        id: "order:" + data.id,
        originalId: data.id,
        sortedId: leftPad(data.id, 12, 0),
        lastUpdate: new Date(data.orderDate).getTime(),
        relatedPartyHash: data.relatedParty.filter(user => user.role.toLowerCase() == 'customer').map(x => exports.fixUserId(x.id)),
        sellerHash: data.relatedParty.filter(user => user.role.toLowerCase() == 'seller').map(x => exports.fixUserId(x.id)),
        relatedParty: data.relatedParty.map(x => x.id)
    };

    return indexCreateData(["href", "priority", "category", "state", "notificationContact", "note"], data, initialData);
};

exports.saveIndexOrder = function saveIndexOrder(data) {
    // logger.info(" ---- saveIndexOrder ----");
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

    return saveIndex('orders', newData, opts);
};

// Request helpers!

exports.getMiddleware = function getMiddleware(reg, createOfferF, queryF, req) {
    // logger.info(" ---- getMiddleware ----");
    var queryPromise = Promise.resolve();

    if (req.method == "GET" && reg.test(req.apiUrl) && (typeof req.query.id === "undefined")) {
        var q = createOfferF(req);
        var handler, isCount;

        // If query is empty or none of the queries have AND and OR, means that there wasn't any filtering parameter, so query for all
        if (q.query.length <= 0 || (q.query.length == 1 && Object.keys(q.query[0].AND).length <= 0)) {
            q.query = [{ AND: {  "*": ["*"] }}];
        }

        if (q.query.length == 1) q.query = q.query[0];

        if ("action" in req.query && req.query.action == 'count') {
            isCount = true;
            handler = (count) => {
                req.apiUrl = '/' + config.endpoints.management.path + '/count/' + count;
            };
        } else {
            isCount = false;
            handler = (results) => {

                var newUrl = req._parsedUrl.pathname + "?id=" + results.map(r => r.document.originalId).join(",");

                for (var key in req.query) {
                    if (["depth", "fields"].indexOf(key) >= 0) {
                        newUrl = newUrl + "&" + key + "=" + req.query[key];
                    }
                }
                req.apiUrl = newUrl;
            };
        }

        queryPromise = queryF(q, isCount)
            .then(handler);
    }
    return queryPromise;
};

var createInitialQuery = function createInitialQuery(req) {
    // logger.info(" ---- createInitialQuery ----");
    var valid_sorts = {
        date: {
            field: "lastUpdate",
            direction: "desc"
        },
        name: {
            field: "name",
            direction: "asc"
        }
    };
    var result = {};
    var sorting = 'date';

    if (typeof req.query.sort !== "undefined" && req.query.sort in valid_sorts) {
        sorting = req.query.sort;
    }

    result.sort = valid_sorts[sorting];

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
    // logger.info(" ---- transformQuery ----");
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
    // logger.info(" ---- genericCreateQuery ----");
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
    // logger.info(" ---- getDataStores ----");
    return indexDataStores;
};
