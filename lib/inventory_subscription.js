/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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

const config = require('./../config')
const url = require('url')
const request = require('request')

const PORT = config.https.enabled
    ? config.https.port || 443 // HTTPS
    : config.port || 80; // HTTP

const createUrl = function createUrl() {
    let inventoryConfig = config.endpoints.inventory;
    return url.format({
        protocol: inventoryConfig.appSsl ? 'https' : 'http',
        hostname: inventoryConfig.host,
        port: inventoryConfig.port,
        pathname: '/' + inventoryConfig.path + '/api/productInventory/v2/hub'
    });
};

const genericRequest = function genericRequest(options) {
    return new Promise((resolve, reject) => {
        request(options, function(err, response, body) {
            if (err) {
                reject(err);
                return;
            }
    
            if (response.statusCode === 200) {
                resolve(JSON.parse(body));
            } else {
                reject('Error reading inventory hubs: ' + response.statusCode);
            }
        });
    })
};

const getHubs = function getHubs() {
    return genericRequest(createUrl());
};

const orderExecute = function orderExecute(events, f) {
    return Promise.all(events.map((event) => {
        return f(event)
    }))
};

// TODO: Check what we are doing with the indexing system
const createInventory = function createInventory(data) {
    //return indexes.saveIndexInventory([data]);
    return Promise.resolve()
};

const deleteInventory = function deleteInventory(data) {
    //return indexes.removeIndex('inventory', data.id);
    return Promise.resolve()
};

// Official API:
// https://projects.tmforum.org/wiki/display/API/Product+Creation+Notification+-+TMF637
// It's not updated...
const handleEvent = function handleEvent(event) {
    switch (event.eventType) {
        case 'ProductCreationNotification':
            return createInventory(event.event.product);
        case 'ProductValueChangeNotification':
            return createInventory(event.event.product);
        case 'ProductStatusChangeNotification':
            return createInventory(event.event.product);
        case 'ProductDeletionNotification':
            return deleteInventory(event.event.product);
        case 'ProductTransactionNotification':
            return orderExecute(event.event, handleEvent);
    }
    return Promise.resolve(false);
};

exports.postNotification = function postNotification(req, res) {
    const body = JSON.parse(req.body);
    return handleEvent(body)
        .then(() => res.end())
        .catch(() => res.end());
};

exports.createSubscription = function createSubscription(path) {
    const callbackUrl = (config.https.enabled ? 'https' : 'http') + '://' + config.host + ':' + PORT + path;

    return getHubs().then((hubs) => {
        if (hubs.filter((x) => x.callback === callbackUrl).length > 0) {
            return Promise.resolve();
        } else {
            const data = { callback: callbackUrl };

            const headers = {
                'content-type': 'application/json'
            };

            const req = {
                method: 'POST',
                url: createUrl(),
                headers: headers,
                body: JSON.stringify(data)
            };

            return new Promise((resolve, reject) => {
                request(req, function(err, response) {
                    if (err || (response.statusCode !== 201 && response.statusCode !== 409)) {
                        reject("It hasn't been possible to create inventory subscription.");
                    } else {
                        resolve();
                    }
                });
            });
        }
    });
};
