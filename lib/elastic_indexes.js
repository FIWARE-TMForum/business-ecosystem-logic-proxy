/* Copyright (c) 2018 - 2019 CoNWeT Lab., Universidad Politécnica de Madrid
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

var Promise = require("promiz"),
    elasticsearch = require("elasticsearch"),
    config = require("../config"),
    logger = require("./logger").logger.getLogger('TMF');

let elasticTimeout = 3000;

var elasticClient = null;

exports.elasticHost = config.indexes.elasticHost;

exports.siTables = {
    offerings: "offerings",
    products: "products",
    catalogs: "catalogs",
    inventory: "inventory",
    orders: "orders"
};

exports.init = function () {
    var p = new Promise();

    elasticClient = new elasticsearch.Client({
	    hosts: exports.elasticHost,
	    log: 'debug'
    });

    elasticClient.ping({ requestTimeout: elasticTimeout }).then(function () {
        logger.info("Connected to elasticSearch! (" + exports.elasticHost + ")");

	    buildIndexes(Object.values(exports.siTables)).then(function (indexes) {
            return indexes;
	    }, function (err) {
            throw new Error(err);
        });

    }, function (e) {
	    logger.info("Cannot connect to elasticSearch! (" + exports.elasticHost + ")");
	    return p.reject(e);
    });
    
    return p.resolve();
};

exports.removeIndex = function removeIndex(path, key) {
    return Promise.resolve();
}

exports.setClient = function(client) {
    elasticClient = client;
}

var elasticExists = function elasticExists(indexName, objectID){
    // logger.info(" ---- elasticExists ----");
    return elasticClient.exists({
        index: indexName,
        type: indexName,
        id: objectID
    });
};

var buildIndex = function (ind) {
    // logger.info(" ---- buildIndex ----");
    var p = new Promise();

    elasticExists(ind, 1).then(function (exists) {
        if(!exists) {
            elasticClient.create({
                index: ind,
                type: ind,
                id: 1,
                body: {}
            });
        }
    }, function (err) {
        p.reject(err);
    });

    return p;
};

var buildIndexes = function (indexes) {
    return Promise.all(indexes.map(buildIndex));
};

exports.close = function () {
    return Promise.resolve();
};

exports.saveIndex = function saveIndex(path, batchdata, opt) {
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

var searchElastic = function searchElastic(path, originalQuery) {
    var stringQuery = "";
    var queryFields = [];
    var proccesedQuery = originalQuery;

    if (originalQuery.query == undefined) {
        proccesedQuery = {
            query: originalQuery,
            sort: {
                field: "lastUpdate",
                direction: "desc"
            }
        }
    }

    Object.keys(proccesedQuery.query).forEach(q => {
        var key = proccesedQuery.query[q];

        if (Object.keys(key)[0] === "AND") {
            key = proccesedQuery.query[q]["AND"];
        }
        stringQuery = stringQuery.concat("(");

        queryFields = []
        Object.keys(key).forEach(k => {
            queryFields.push(k);
            stringQuery = stringQuery.concat(key[k][0] + " AND ");
        });

        stringQuery = stringQuery.substring(0, stringQuery.lastIndexOf(" AND ")) + ") ";
    });

    stringQuery = stringQuery.substring(0, stringQuery.lastIndexOf(" "));

    var req = {
        index: path,
        type: path,
        sort: [translateSortToElastic(proccesedQuery.sort)],
        from: proccesedQuery.offset,
        size: proccesedQuery.pageSize,

        body: {query: {query_string: { fields: queryFields, query: stringQuery}}}
    };

    return Promise.resolve(elasticClient.search(req));
};

exports.search = function search(path, originalQuery) {
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

exports.count = function count(path, query) {
    return Promise.resolve(searchElastic(path, query)).then( r => {
        return r.hits.total;
    });
};

exports.getDataStores = function getDataStores() {
    return indexDataStores;
};