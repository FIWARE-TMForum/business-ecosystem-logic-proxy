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

                if ([400, 403, 409].indexOf(status) >= 0) {
                    var parsedResp = JSON.parse(body);
                    message = parsedResp['message'];
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

    var validateUsage = function(usageInfo, userInfo, callback)  {
        makeStoreRequest(
            '/charging/api/orderManagement/accounting/',
            usageInfo,
            userInfo,
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
