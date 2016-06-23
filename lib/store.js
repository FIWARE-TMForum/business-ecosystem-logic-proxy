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

var config = require('./../config'),
    request = require('request'),
    utils = require('./utils');

var storeClient = (function() {

    var makeStoreRequest = function(path, body, userInfo, errMsg, callback) {
        // Build headers
        var headers = {
            'content-type': 'application/json',
            'accept': 'application/json'
        };

        if (userInfo) {
            utils.attachUserHeaders(headers, userInfo);
        }

        var url = utils.getAPIURL(config.appSsl, config.appHost, config.endpoints.charging.port, path);

        // Make the request
        var options = {
            url: url,
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        };

        request(options, function(err, response, body) {

            if (err || response.statusCode >= 400) {

                var status = response ? response.statusCode : 504;
                var message = errMsg;

                if ([400, 403, 409, 422].indexOf(status) >= 0) {
                    var parsedResp = JSON.parse(body);
                    message = parsedResp['error'];
                }

                callback({
                    status: status,
                    message: message
                });

            } else {
                callback(null, {
                    status: response.statusCode,
                    headers: response.headers,
                    body: body
                });
            }
        });
    };

    var validateProduct = function(productInfo, userInfo, callback) {
        // Build Body
        var body = {
            'action': 'create',
            'product': productInfo
        };

        makeStoreRequest(
            '/charging/api/assetManagement/assets/validateJob',
            body,
            userInfo,
            'The server has failed validating the product specification',
            callback
        );
    };

    var validateOffering = function(offeringInfo, userInfo, callback) {
        // Build Body
        var body = {
            'action': 'create',
            'offering': offeringInfo
        };

        makeStoreRequest(
            '/charging/api/assetManagement/assets/offeringJob',
            body,
            userInfo,
            'The server has failed validating the offering',
            callback
        );
    };

    var notifyOrder = function(orderInfo, userInfo, callback) {
        makeStoreRequest(
            '/charging/api/orderManagement/orders',
            orderInfo,
            userInfo,
            'The server has failed processing your order',
            callback
        );
    };

    var refund = function(orderId, userInfo, callback) {

        var body = {
            orderId: orderId
        };

        makeStoreRequest(
            '/charging/api/orderManagement/orders/refund',
            body,
            userInfo,
            'The server has failed at the time of refunding the order',
            callback
        );
    };

    var validateUsage = function(usageInfo, callback)  {
        makeStoreRequest(
            '/charging/api/orderManagement/accounting/',
            usageInfo,
            null,
            'The server has failed validating the usage',
            callback
        );
    };

    return {
        validateProduct: validateProduct,
        validateOffering: validateOffering,
        notifyOrder: notifyOrder,
        validateUsage: validateUsage,
        refund: refund
    };

})();

exports.storeClient = storeClient;
