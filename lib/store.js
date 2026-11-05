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

    const makeValidateCall = function(action, productInfo, userInfo, callback) {
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

    const validateService = function(action, serviceInfo, userInfo, callback) {
        const errMsg = 'The server has failed validating the service specification';
        makeStoreRequest(
            '/charging/api/assetManagement/assets/validateServiceJob',
            { action: action, service: serviceInfo },
            userInfo,
            errMsg,
            (err, response) => {
                if (err) {
                    return callback(err);
                }
                // Validation must finish synchronously before the catalog write.
                if (response.status !== 200) {
                    return callback({ status: 502, message: errMsg });
                }
                callback(null, response);
            }
        );
    };

    const validateResource = function(action, resourceInfo, userInfo, callback) {
        const errMsg = 'The server has failed validating the resource specification';
        makeStoreRequest(
            '/charging/api/assetManagement/assets/validateResourceJob',
            { action: action, resource: resourceInfo },
            userInfo,
            errMsg,
            (err, response) => {
                if (err) {
                    return callback(err);
                }
                // Validation must finish synchronously before the catalog write.
                if (response.status !== 200) {
                    return callback({ status: 502, message: errMsg });
                }
                callback(null, response);
            }
        );
    };

    const validateProduct = function(productInfo, userInfo, callback) {
        makeValidateCall('create', productInfo, userInfo, callback);
    };

    const updateProduct = function(productInfo, userInfo, callback) {
        makeValidateCall('update', productInfo, userInfo, callback);
    };

    const postCreateProduct = function(productInfo, userInfo, callback) {
        makeValidateCall('post-create', productInfo, userInfo, callback);
    };

    const postUpdateProduct = function(productInfo, userInfo, callback) {
        makeValidateCall('post-update', productInfo, userInfo, callback);
    };

    const makeOfferingCall = function(action, offeringInfo, userInfo, callback) {
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

    const validateOffering = function(offeringInfo, userInfo, callback) {
        // Build Body
        makeOfferingCall('create', offeringInfo, userInfo, callback);
    };

    const updateOffering = function(offeringInfo, userInfo, callback) {
        makeOfferingCall('update', offeringInfo, userInfo, callback);
    };

    const postCreateOffering = function(offeringInfo, userInfo, callback) {
        makeOfferingCall('post-create', offeringInfo, userInfo, callback);
    };

    const postUpdateOffering = function(offeringInfo, userInfo, callback) {
        makeOfferingCall('post-update', offeringInfo, userInfo, callback);
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

    const notifyOrder = function(orderInfo, userInfo, callback) {
        makeStoreRequest(
            '/charging/api/orderManagement/orders',
            orderInfo,
            userInfo,
            'The server has failed processing your order',
            callback
        );
    };

    const refund = function(orderId, userInfo, callback) {
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

    const validateUsage = function(usageInfo, callback) {
        makeStoreRequest(
            '/charging/api/orderManagement/accounting/',
            usageInfo,
            null,
            'The server has failed validating the usage',
            callback
        );
    };

    const refreshUsage = function(orderId, productId, callback) {
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
        validateService: validateService,
        validateResource: validateResource,
        validateProduct: validateProduct,
        updateProduct: updateProduct,
        postCreateProduct: postCreateProduct,
        postUpdateProduct: postUpdateProduct,
        validateOffering: validateOffering,
        updateOffering: updateOffering,
        postCreateOffering: postCreateOffering,
        postUpdateOffering: postUpdateOffering,
        notifyOrderCompleted: notifyOrderCompleted,
        notifyOrder: notifyOrder,
        validateUsage: validateUsage,
        refreshUsage: refreshUsage,
        refund: refund
    };
})();

exports.storeClient = storeClient;
