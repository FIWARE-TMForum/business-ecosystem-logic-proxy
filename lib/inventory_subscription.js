/* Copyright (c) 2015 - 2018 CoNWeT Lab., Universidad Politécnica de Madrid
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

var config = require('./../config'),
    indexes = require('./indexes'),
    url = require('url'),
    utils = require('./utils'),
    Promise = require('promiz'),
    request = require('request');

var PORT = config.https.enabled ?
        config.https.port || 443 :      // HTTPS
        config.port || 80;              // HTTP

var createUrl = function createUrl() {
    let inventoryConfig = config.endpoints.inventory;
    return url.format({
        protocol: inventoryConfig.appSsl ? 'https': 'http',
        hostname: inventoryConfig.host,
        port: inventoryConfig.port,
        pathname: '/'+ inventoryConfig.path + '/api/productInventory/v2/hub',
    });
};

var genericRequest = function genericRequest(options, p) {
    request(options, function (err, response, body) {
        if (err) {
            p.reject(err);
            return;
        }

        if (response.statusCode == 200) {
            p.resolve(JSON.parse(body));
        } else {
            p.reject('Error reading inventory hubs: ' + response.statusCode);
        }
    });
};

var getHubs = function getHubs() {
    let p = new Promise();
    let url = createUrl();

    genericRequest(url, p);

    return p;
};

var orderExecute = function orderExecute(events, f) {
    var p = Promise.resolve(true);

    events.forEach(event => {
        p = p.then(() => f(event));
    });

    return p;
};

var createInventory = function createInventory(data) {
    return indexes.saveIndexInventory([data]);
};

var deleteInventory = function deleteInventory(data) {
    return indexes.removeIndex("inventory", data.id);
};

// Official API:
// https://projects.tmforum.org/wiki/display/API/Product+Creation+Notification+-+TMF637
// It's not updated...
var handleEvent = function handleEvent(event) {
    switch (event.eventType) {
    case "ProductCreationNotification":
        return createInventory(event.event.product);
    case "ProductValueChangeNotification":
        return createInventory(event.event.product);
    case "ProductStatusChangeNotification":
        return createInventory(event.event.product);
    case "ProductDeletionNotification":
        return deleteInventory(event.event.product);
    case "ProductTransactionNotification":
        return orderExecute(event.event, handleEvent);
    }
    return Promise.resolve(false);
};

exports.postNotification = function postNotification(req, res) {
    var body = JSON.parse(req.body);
    return handleEvent(body)
        .then(() => res.end())
        .catch(() => res.end());
};

exports.createSubscription = function createSubscription(path) {
    var callbackUrl = (config.https.enabled ? "https" : "http") + "://" + config.host + ":" + PORT + path;

    return getHubs()
        .then(hubs => {
            if (hubs.filter(x => x.callback === callbackUrl).length > 0) {
                return Promise.resolve();
            } else {
                var data = { callback: callbackUrl };

                var headers = {
                    "content-type": "application/json"
                };

                var req = {
                    method: "POST",
                    url: createUrl(),
                    headers: headers,
                    body: JSON.stringify(data)
                };

                var p = new Promise();
                request(req, function (err, response) {
                    if (err || (response.statusCode !== 201 && response.statusCode !== 409)) {
                        p.reject("It hasn't been possible to create inventory subscription.");
                    } else {
                        p.resolve();
                    }
                });

                return p;
            };
        });
};
