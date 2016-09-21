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


var searchIndex = require("search-index"),
    Promise = require("promiz"),
    md5 = require("blueimp-md5"),
    leftPad = require("left-pad");

exports.siTables = {
    offerings: "indexes/offerings",
    products: "indexes/products",
    catalogs: "indexes/catalogs"
};

var safeIndexExecute = function safeIndexExecute(path, method) {
    var p = new Promise();
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

    return exports.searchProductId(id)
        .then(results => (results.hits.length > 0 && results.hits[0].document.relatedParty.length > 0) ? { id: results.hits[0].document.relatedParty[0] } : {})
        .catch(() => Promise.resolve({}));
};

exports.fixUserId = function fixUserId(id) {
    return md5(id);
};

exports.convertCatalogData = function convertCatalogData(data) {
    var initialData = { id: "catalog:" + data.id,
                        originalId: data.id,
                        sortedId: leftPad(data.id, 12, 0),
                        relatedPartyHash: data.relatedParty.map(x => exports.fixUserId(x.id)).join(":"),
                        relatedParty: data.relatedParty.map(x => x.id).join(":")
                      };

    return indexCreateData(["href", "name", "lifecycleStatus"], data, initialData);
};

exports.saveIndexCatalog = function saveIndexCatalog(data) {
    var newData = data.map(exports.convertCatalogData);

    var ops = {};

    return exports.saveIndex(exports.siTables.catalogs, newData, ops);
};

exports.convertProductData = function convertProductData(data) {
    var searchable = [data.name, data.brand].join(" ");

    var initialData = { id: "product:" + data.id,
                        originalId: data.id,
			sortedId: leftPad(data.id, 12, 0),
                        body: searchable,
                        relatedPartyHash: data.relatedParty.map(x => exports.fixUserId(x.id)).join(":"),
                        relatedParty: data.relatedParty.map(x => x.id).join(":") };

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

var convertOffer = function convertOffer(data, user) {
    data.productSpecification = data.productSpecification || {};

    var searchable = [data.name, data.description].join(" ");

    var initialData = { id: "offering:" + data.id,
                        originalId: data.id,
                        sortedId: leftPad(data.id, 12, 0),
                        body: searchable,
                        userId: exports.fixUserId(user.id),
                        productSpecification: data.productSpecification.id };

    var newData = indexCreateData(["href", "lifecycleStatus", "isBundle"], data, initialData);

    return newData;
};

var convertNotBundle = function convertNotBundle(data, user) {
    return getUserFromOffer(data.productSpecification.id, user)
        .then(user => Promise.resolve(convertOffer(data, user)));
};

var convertBundle = function convertBundle(data, user) {
    if (!!user) {
        return Promise.resolve(convertOffer(data, user));
    } else {
        return exports.searchOfferingId(data.bundledProductOffering[0].id)
            .then(offer => getUserFromOffer(offer.hits[0].document.productSpecification, user))
            .then(user => Promise.resolve(convertOffer(data, user)));
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
    var p = Promise.resolve([]);
    data.forEach(x => {
        p = p.then(arr =>
                   exports.convertOfferingData(x, user).then(newD => arr.concat([newD]))
                  );
    });

    return p;
};

var offersBundleAtTheEnd = function offersBundleAtTheEnd(data) {
    var dataNotB = data.filter(x => !x.isBundle);
    var dataB = data.filter(x => x.isBundle);
    return dataNotB.concat(dataB);
};

exports.saveIndexOffering = function saveIndexOffering(data, user) {
    var prom = blockConvert(offersBundleAtTheEnd(data), user);

    return prom
        .then(newData => {
            var ops = {
                fieldOptions: [
                    { fieldName: "body",
                      filter: true
                    }
                ]
            };

            return exports.saveIndex(exports.siTables.offerings, newData, ops);
        });
};
