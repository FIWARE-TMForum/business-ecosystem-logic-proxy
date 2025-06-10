/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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

const axios = require('axios');
const config = require('./../config');
const utils = require('./utils');

const storeClient = (function() {
    const makeStoreRequest = function(path, body, userInfo, errMsg, callback) {
        // Build headers
        const headers = {
            'content-type': 'application/json',
            accept: 'application/json'
        };

        if (userInfo) {
            utils.attachUserHeaders(headers, userInfo);
        }

        const url = utils.getAPIURL(
            config.endpoints.charging.appSsl,
            config.endpoints.charging.host,
            config.endpoints.charging.port,
            `${config.endpoints.charging.apiPath}${path}`
        );

        // Make the request
        const options = {
            url: url,
            method: 'POST',
            headers: headers,
            data: body
        };

        axios.request(options).then((response) => {
            callback(null, {
                status: response.status,
                headers: response.headers,
                body: response.data
            });
        }).catch((err) => {
            let status = 504
            let message = errMsg

            if (err.response != null) {
                status = err.response.status

                if ([400, 403, 409, 422].indexOf(status) >= 0) {
                    message = err.response.data['error'];
                }
            }

            callback({
                status: status,
                message: message
            });
        });
    };

    var makeValidateCall = function(action, productInfo, userInfo, callback) {
        // Build Body
        var body = {
            action: action,
            product: productInfo
        };

        makeStoreRequest(
            '/charging/api/assetManagement/assets/validateJob',
            body,
            userInfo,
            'The server has failed validating the product specification',
            callback
        );
    };

    var validateProduct = function(productInfo, userInfo, callback) {
        makeValidateCall('create', productInfo, userInfo, callback);
    };

    var attachProduct = function(productInfo, userInfo, callback) {
        makeValidateCall('attach', productInfo, userInfo, callback);
    };

    var rollbackProduct = function(productInfo, userInfo, callback) {
        makeValidateCall('rollback_create', productInfo, userInfo, callback);
    };

    var upgradeProduct = function(productInfo, userInfo, callback) {
        makeValidateCall('upgrade', productInfo, userInfo, callback);
    };

    var attachUpgradedProduct = function(productInfo, userInfo, callback) {
        makeValidateCall('attach_upgrade', productInfo, userInfo, callback);
    };

    var rollbackProductUpgrade = function(productInfo, userInfo, callback) {
        makeValidateCall('rollback_upgrade', productInfo, userInfo, callback);
    };

    var makeOfferingCall = function(action, offeringInfo, userInfo, callback) {
        var body = {
            action: action,
            offering: offeringInfo
        };

        makeStoreRequest(
            '/charging/api/assetManagement/assets/offeringJob',
            body,
            userInfo,
            'The server has failed validating the offering',
            callback
        );
    };

    var validateOffering = function(offeringInfo, userInfo, callback) {
        // Build Body
        makeOfferingCall('create', offeringInfo, userInfo, callback);
    };

    var attachOffering = function(offeringInfo, userInfo, callback) {
        // Build Body
        makeOfferingCall('attach', offeringInfo, userInfo, callback);
    };

    var updateOffering = function(offeringInfo, userInfo, callback) {
        makeOfferingCall('update', offeringInfo, userInfo, callback);
    };

    const notifyOrderCompleted = function(orderId, userInfo, callback) {
        makeStoreRequest(
            `/charging/api/orderManagement/orders/completed/${orderId}`,
            {},
            userInfo,
            'The server has failed processing your order',
            callback
        );
    }

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

    var validateUsage = function(usageInfo, callback) {
        makeStoreRequest(
            '/charging/api/orderManagement/accounting/',
            usageInfo,
            null,
            'The server has failed validating the usage',
            callback
        );
    };

    var refreshUsage = function(orderId, productId, callback) {
        makeStoreRequest(
            '/charging/api/orderManagement/accounting/refresh/',
            {
                orderId: orderId,
                productId: productId
            },
            null,
            'The server has failed loading usage info',
            callback
        );
    };

    return {
        validateProduct: validateProduct,
        attachProduct: attachProduct,
        rollbackProduct: rollbackProduct,
        upgradeProduct: upgradeProduct,
        attachUpgradedProduct: attachUpgradedProduct,
        rollbackProductUpgrade: rollbackProductUpgrade,
        validateOffering: validateOffering,
        attachOffering: attachOffering,
        updateOffering: updateOffering,
        notifyOrderCompleted: notifyOrderCompleted,
        notifyOrder: notifyOrder,
        validateUsage: validateUsage,
        refreshUsage: refreshUsage,
        refund: refund
    };
})();

exports.storeClient = storeClient;
