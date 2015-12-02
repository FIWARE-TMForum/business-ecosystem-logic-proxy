var config = require('./../config'),
    utils = require('./utils'),
    http = require('./httpClient');

var storeClient = (function() {

    var makeStoreRequest = function(path, body, userInfo, errMsg, callback) {
        // Build headers
        var headers = {
            'content-type': 'application/json',
            'accept': 'application/json'
        };

        utils.attachUserHeaders(headers, userInfo);

        // Make the request
        var options = {
            host: config.appHost,
            port: config.endpoints.charging.port,
            path: path,
            method: 'POST',
            headers: headers
        };

        var protocol = config.appSsl ? 'https' : 'http';
        http.request(protocol, options, JSON.stringify(body), function(err, res) {

            if (err) {
                var status = err.status;
                var message = errMsg;

                if (status === 400 || status === 409 || status == 403) {
                    var parsedResp = JSON.parse(err.body);
                    message = parsedResp['message'];
                }

                callback({
                    status: status,
                    message: message
                });

            } else {
                callback(null, res);
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
