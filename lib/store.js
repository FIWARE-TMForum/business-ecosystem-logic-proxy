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

        utils.attachUserHeaders(headers, userInfo);

        var url = (config.appSsl ? 'https' : 'http') + '://' + config.appHost + ':' +
            config.endpoints.charging.port + path;

        // Make the request
        var options = {
            url: url,
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        };

        request(options, function(err, response, body) {

            if (err || response.statusCode >= 400) {

                var status = response ? response.statusCode : null;
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

    var notifyOrder = function(orderInfo, userInfo, callback) {
        makeStoreRequest(
            '/charging/api/orderManagement/orders',
            orderInfo,
            userInfo,
            'The server has failed processing your order',
            callback
        );
    };

    return {
        validateProduct: validateProduct,
        notifyOrder: notifyOrder
    };

})();

exports.storeClient = storeClient;
