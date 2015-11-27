var http = require('http'),
    https = require('https'),
    log = require('./logger').logger.getLogger("HTTP-Client");


/**
 * Send a request to a HTTP(S) server depending on the options
 * @param {String} protocol The protocol to be used. 'http' by default
 * @param {Object} options The options of the request (server, port, path, headers...)
 * @param data {Object} The body of the request
 * @param {Function} The callback to be called when the request ends
 */
exports.request = function(protocol, options, data, callback) {

    var methodsWithoutBody = ['GET', 'DELETE'];
    var method = options.method.toUpperCase();

    // Transfer-Encoding avoid Glassfish to remove resources
    if (options.headers === undefined) {
        options.headers = {};
    }

    // Set a default value for the header
    options.headers['transfer-encoding'] = '';

    if (methodsWithoutBody.indexOf(method) === -1 && data !== undefined) {
        options.headers['content-length'] = Buffer.byteLength(data);
    }

    // Make the request
    var httpLib = protocol === 'https' ? https : http;
    var request = httpLib.request(options, function(res) {

        var body = '';

        res.on('data', function(chunk) {
            body += chunk;
        });

        res.on('end', function() {

            var httpStatus = res.statusCode;

            var callbackContent = {
                status: httpStatus,
                body: body,
                headers: res.headers
            };

            // The err parameter of the callback is set when the
            // response code is different from 2XX
            if (Math.floor(httpStatus / 100) == 2) {
                callback(null, callbackContent);
            } else {
                callback(callbackContent, null);
            }
        });

    });

    // Body is not send for GET and DELETE requests (if present)
    if (methodsWithoutBody.indexOf(method) === -1 && data !== undefined) {
        request.write(data);
    }

    // Just in case the server is not working...
    request.on('error', function(err) {
        // 503: Service unavailable
        callback({
            status: 503,
            body: JSON.stringify(err),
            headers: {}
        });
    });

    request.end();
};

/**
 * Proxies an HTTP(s) request: depending on the received HTTP request, the method
 * calls to the final server and send the result (status, headers & body) to the 
 * initial user (based on the server response received as parameter)
 * @param {String} protocol The protocol to be used. 'http' by default
 * @param {Object} options The options of the request (server, port, path, headers...)
 * @param data {Object} The body of the request
 * @param proxiedRes {Object} The response that should be used to redirect the request to the
 * user
 */
exports.proxyRequest = function(protocol, options, data, proxiedRes) {

    // Define the callback
    var callback = function(err, result) {

        var callbackContent = err || result;
        var status = callbackContent.status;
        var body = callbackContent.body;
        var headers = callbackContent.headers;

        if (err) {
            log.warn('Request ERROR', status, body);
        } else {
            log.info('Request Ok', status, body)
        }

        proxiedRes.statusCode = status;

        for (var header in headers) {
            proxiedRes.setHeader(header, headers[header]);
        }

        proxiedRes.write(body);
        proxiedRes.end();
    };

    // Redirect the request
    this.request(protocol, options, data, callback);

}