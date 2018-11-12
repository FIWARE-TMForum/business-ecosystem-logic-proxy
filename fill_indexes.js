/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the bae-logic-proxy-test of the
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

var config = require("./config"),
    indexes = require("./lib/indexes.js"),
    request = require("request"),
    utils = require("./lib/utils"),
    Promise = require("promiz");

var createUrl = function createUrl(api, extra) {
    return utils.getAPIProtocol(api) + "://" + utils.getAPIHost(api) + ":" + utils.getAPIPort(api) + extra;
};

var genericRequest = function genericRequest(options, extra) {
    var p = new Promise();

    request(options, function (err, response, body) {
        if (err) {
            console.log(err);
            p.reject(err);
            return;
        }

        if (response.statusCode == 200) {
            var parsedBody = JSON.parse(body);

            if (extra) {
                parsedBody.forEach(function (element) {
                    element[extra.field] = extra.value;
                });
            }
            p.resolve(parsedBody);
        } else {
            p.reject("Unexpected HTTP error code: " + response.statusCode);
            return;
        }
    });

    return p;
};

var getProducts = function getProducts() {
    var url = createUrl("DSProductCatalog", "/DSProductCatalog/api/catalogManagement/v2/productSpecification");
    return genericRequest(url);
};

var getOfferings = function getOfferings(catalog, qstring) {
     // For every catalog!
    var url;
    if (catalog) {
        url = createUrl("DSProductCatalog", "/DSProductCatalog/api/catalogManagement/v2/catalog/" + catalog + "/productOffering");
    } else {
        url = createUrl("DSProductCatalog", "/DSProductCatalog/api/catalogManagement/v2/productOffering");
    }

    if (qstring) {
        url += qstring;
    }

    return genericRequest(url, {
        field: "catalog",
        value: catalog
    });
};

var getCatalogs = function getCatalogs() {
    var url = createUrl("DSProductCatalog", "/DSProductCatalog/api/catalogManagement/v2/catalog");
    return genericRequest(url);
};

var getInventory = function getInventory() {
    var url = createUrl("DSProductInventory", "/DSProductInventory/api/productInventory/v2/product");
    return genericRequest(url);
};

var getOrders = function getOrders() {
    var url = createUrl("DSProductOrdering", "/DSProductOrdering/api/productOrdering/v2/productOrder");
    return genericRequest(url);
};

var downloadProducts = function downloadProducts() {
    return getProducts()
        .then(indexes.saveIndexProduct);
};

var downloadOfferings = function downloadOfferings(catalog, qstring) {
    return getOfferings(catalog, qstring)
        .then(indexes.saveIndexOffering);
};

var downloadCatalogOfferings = function downloadCatalogOfferings(catalogs) {
    var promise = Promise.resolve();
    if (catalogs.length) {
        catalogs.forEach(function (catalog) {
            promise = promise.then(function () {
                return downloadOfferings(catalog.id, '?isBundle=false');
            });
        });
        catalogs.forEach(function (catalog) {
            promise = promise.then(function () {
                return downloadOfferings(catalog.id, '?isBundle=true');
            });
        });

    } else {
        promise = promise.then(function() {
            return downloadOfferings();
        });
    }
    promise = promise.then(function ()  {
        return indexes.saveIndexCatalog(catalogs)
    });
    return promise;
};

var downloadCatalogs = function downloadCatalogs() {
    return getCatalogs()
        .then(downloadCatalogOfferings);
};

var downloadInventory = function downloadInventory() {
    return getInventory()
        .then(indexes.saveIndexInventory);
};

var downloadOrdering = function downloadOrdering() {
    return getOrders()
        .then(indexes.saveIndexOrder);
};


var logAllIndexes = function logAllIndexes(path) {
    return indexes.search(path, { AND: { "*": ["*"] } })
            .catch(err => console.log(err))
    .then(results => {
        console.log(results);
    results.hits.forEach(x => console.log(x));
});
};

indexes.init()
    .then(downloadProducts)
    .then(downloadCatalogs)
    .then(downloadInventory)
    .then(downloadOrdering)
    .then(indexes.close)
    .then(() => console.log("All saved!"))
    .catch(e => console.log("Error: ", e.stack));


// logAllIndexes(indexes.siTables.catalogs);
// logAllIndexes(indexes.siTables.products);
// logAllIndexes(indexes.siTables.offerings);
// logAllIndexes(indexes.siTables.inventory);
// logAllIndexes(indexes.siTables.orders);
