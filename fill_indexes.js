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


var config = require("./config"),
    indexes = require("./lib/indexes.js"),
    request = require("request"),
    utils = require("./lib/utils"),
    Promise = require("promiz");

var createUrl = function createUrl(api, extra) {
    return (config.appSsl ? "https" : "http") + "://" + config.appHost + ":" + utils.getAPIPort(api) + extra;
};

var genericRequest = function genericRequest(options) {
    var p = new Promise();
    request(options, function (err, response, body) {
        if (err) {
            console.log(err);
            p.reject(err);
            return;
        }

        if (response.statusCode == 200) {
            p.resolve(JSON.parse(body));
        }
    });

    return p;
};

var getProducts = function getProducts() {
    var url = createUrl("DSProductCatalog", "/DSProductCatalog/api/catalogManagement/v2/productSpecification");
    return genericRequest(url);
};

var getOfferings = function getOfferings() {
     // For every catalog!
    var url = createUrl("DSProductCatalog", "/DSProductCatalog/api/catalogManagement/v2/productOffering");
    return genericRequest(url);
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

var logAllIndexes = function logAllIndexes(path) {
    return indexes.search(path, { AND: { "*": ["*"] } })
        .catch(err => console.log(err))
        .then(results => {
            console.log(results);
            results.hits.forEach(x => console.log(x));
        });
};

var downloadProducts = function downloadProducts() {
    return getProducts()
        .then(indexes.saveIndexProduct);
};

var downloadOfferings = function downloadOfferings() {
    return getOfferings()
        .then(indexes.saveIndexOffering);
};

var downloadCatalogs = function downloadCatalogs() {
    return getCatalogs()
        .then(indexes.saveIndexCatalog);
};

var downloadInventory = function downloadInventory() {
    return getInventory()
        .then(indexes.saveIndexInventory);
};

var downloadOrdering = function downloadOrdering() {
    return getOrders()
        .then(indexes.saveIndexOrder);
};

downloadCatalogs()
    .then(downloadProducts)
    .then(downloadOfferings)
    .then(downloadInventory)
    .then(downloadOrdering)
    .then(() => console.log("All saved!"))
    .catch(e => console.log("Error: ", e));

// logAllIndexes(indexes.siTables.catalogs);
// logAllIndexes(indexes.siTables.products);
// logAllIndexes(indexes.siTables.offerings);
// logAllIndexes(indexes.siTables.inventory);
// logAllIndexes(indexes.siTables.orders);
