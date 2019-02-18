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
    Promise = require("promiz"),
    level = require("levelup"),
    down = require("leveldown"),
    Readable = require('stream').Readable,
    AsyncLock = require("async-lock");

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

exports.setClient = function(client) {
    elasticClient = client;
}

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
                p.resolve();
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

exports.saveIndex = function saveIndex(path, batchdata, opt) {
    return safeIndexExecute(path, function (si, cb) {

        const dataStream = new Readable({ objectMode: true });

        batchdata.forEach((data) => {
            dataStream.push(data);
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
exports.search = function search(path, query) {
    return queryIndexExecute(path, function (si, cb) {
        var q = query;
        var results = [];

        if (!q.query) {
            q = { query: query };
        }
	
        si.search(q)
            .on('data', (result) => results.push(result))
            .on('error', (err) => cb(err))
            .on('end', () => {
		cb(null, results);
	    });
    });
};

exports.count = function count(path, query) {
    return queryIndexExecute(path, function (si, cb) {
        var q = query;
        if (!q.query) {
            q = { query: query };
        }

        si.totalHits(q, (err, count) => {
            cb(err, count);
        });
    });
};

exports.getDataStores = function getDataStores() {
    return indexDataStores;
};
