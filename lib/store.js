var config = require('./../config.js'),
    utils = require('./utils/utils.js'),
    http = require('./httpClient.js');

var storeClient = (function() {
    var validateProduct = function(productInfo, userInfo, callback, callbackError) {
        // Build headers
        var headers = {
            'content-type': 'application/json'
        };

        utils.attachUserHeaders(headers, userInfo);

        // Build Body
        var body = {
            'action': 'create',
            'product': JSON.parse(productInfo)
        };

        // Make the request
        var options = {
            host: config.appHost,
            port: config.endpoints.charging.port,
            path: '/charging/api/assetManagement/assets/validateJob',
            method: 'POST',
            headers: headers
        };

        var protocol = config.appSsl ? 'https' : 'http';
        http.request(protocol, options, JSON.stringify(body), callback, function(status, resp) {
            var msg = 'The server has failed validating the product specification';

            if (status === 400 || status === 409 || status == 403) {
                var parsedResp = JSON.parse(resp);
                msg = parsedResp['message'];
            }

            callbackError(status, msg);
        });
    };

    return {
        validateProduct: validateProduct
    };

})();

exports.storeClient = storeClient;
