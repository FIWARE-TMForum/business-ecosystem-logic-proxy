var express = require('express'),
    app = express(),
    http = require('http'),
    https = require('https'),
    log = require('./logger').logger.getLogger("HTTP-Client");


/**
 * Send a request to a HTTP(S) server depending on the options
 * @param {String} protocol The protocol to be used. 'http' by default
 * @param {dict} options The options of the request (server, port, path, headers...)
 * @param data The body of the request
 * @param proxiedRes The Server Response received when proxying HTTP requests. If cb
 * is undefined, a default callback will be defined so the result of the request will
 * be piped to the client.
 * @param {Function} The callback to be called when the request succeeds (status 2XX)
 * @param {Function} The callback to be called when the request fails (connection error or status != 2XX)
 */
exports.request = function(protocol, options, data, proxiedRes, cb, errorCb) {

    // Define default callbacks
    cb = cb || function(status, resp, headers) {
        
        log.info("Request OK", status, resp);

        proxiedRes.statusCode = status;

        for (var header in headers) {
            proxiedRes.setHeader(header, headers[header]);
        }

        proxiedRes.write(resp);
        proxiedRes.end();
    };

    errorCb = errorCb || function(status, err) {
        log.error("Request ERROR", status, err);
        proxiedRes.statusCode = status;
        proxiedRes.send(err);
    };

    // Make the request
    var httpLib = protocol === 'https' ? https : http;
    var request = httpLib.request(options, function(res) {

        var body = '';

        res.on('data', function(chunk) {
            body += chunk;
        });

        res.on('end', function() {
            // The normal callback can only be called when we have 2XX response codes
            var httpStatus = res.statusCode;
            if (Math.floor(httpStatus / 100) == 2) {
                cb(httpStatus, body, res.headers);
            } else {
                errorCb(httpStatus, body);
            }
        });

    });

    if (data !== undefined) {
        request.write(data);
    }

    // Just in case the server is not working...
    request.on('error', function(err) {
        // 503: Service unavailable
        errorCb(503, err);
    });

    request.end();

}