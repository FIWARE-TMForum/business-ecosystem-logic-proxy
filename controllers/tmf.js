var config = require('./../config'),

    // TMF APIs
    catalog = require('./tmf-apis/catalog').catalog,
    inventory = require('./tmf-apis/inventory').inventory,
    ordering = require('./tmf-apis/ordering').ordering,
    charging = require('./tmf-apis/charging').charging,
    rss = require('./tmf-apis/rss').rss,
    party = require('./tmf-apis/party').party,
    billing = require('./tmf-apis/billing').billing,
    
    // Other dependencies
    logger = require('./../lib/logger').logger.getLogger('TMF'),
    request = require('request'),
    url = require('url'),
    utils = require('./../lib/utils');

var tmf = (function() {

    var apiControllers = {};
    apiControllers[config.endpoints.catalog.path] = catalog;
    apiControllers[config.endpoints.ordering.path] = ordering;
    apiControllers[config.endpoints.inventory.path] = inventory;
    apiControllers[config.endpoints.charging.path] = charging;
    apiControllers[config.endpoints.rss.path] = rss;
    apiControllers[config.endpoints.party.path] = party;
    apiControllers[config.endpoints.billing.path] = billing;

    var getAPIName = function(apiUrl) {
        return apiUrl.split('/')[1];
    };

    var sendError = function(res, err) {
        var status = err.status;
        var errMsg = err.message;

        res.status(status);
        res.json({ error: errMsg });
        res.end();
    };

    var redirectRequest = function (req, res) {

        if (req.user) {
            utils.attachUserHeaders(req.headers, req.user);
        }

        var api = getAPIName(req.apiUrl);

        var url = (config.appSsl ? 'https' : 'http') + '://' + config.appHost + ':' + utils.getAPIPort(api) + req.apiUrl;

        var options = {
            url: url,
            method: req.method,
            headers: utils.proxiedRequestHeaders(req)
        };

        if (typeof(req.body) === 'string') {
            options.body = req.body;
        }

        // PROXY THE REQUEST
        request(options, function(err, response, body) {

            var completeRequest = function(result) {
                res.status(result.status);

                for (var header in result.headers) {
                    res.setHeader(header, result.headers[header]);
                }

                res.write(result.body);
                res.end();
            };

            if (err) {
                res.status(504).json({ error: 'Service unreachable' });
            } else {

                var result = {
                    status: response.statusCode,
                    headers: response.headers,
                    hostname: req.hostname,
                    secure: req.secure,
                    body: body
                };

                // Execute postValidation if status code is lower than 400 and the
                // function is defined
                if (response.statusCode < 400 && apiControllers[api] !== undefined
                        && apiControllers[api].executePostValidation) {

                    result.user = req.user;
                    result.method = req.method;
                    result.apiUrl = req.apiUrl;

                    apiControllers[api].executePostValidation(result, function(err) {

                        var basicLogMessage = 'Post-Validation (' + api + '): ';

                        if (err) {
                            utils.log(logger, 'warn', req, basicLogMessage + err.message);
                            res.status(err.status).json({ error: err.message });
                        } else {
                            utils.log(logger, 'info', req, basicLogMessage + 'OK');
                            completeRequest(result);
                        }
                    });
                } else {
                    completeRequest(result);
                }
            }

        });
    };

    var checkPermissions = function(req, res) {

        var api = getAPIName(req.apiUrl);

        if (apiControllers[api] === undefined) {

            utils.log(logger, 'warn', req, 'API ' + api + ' not defined');

            sendError(res, {
                status: 404,
                message: 'Path not found'
            });

        } else {
            apiControllers[api].checkPermissions(req, function(err) {

                var basicLogMessage = 'Pre-Validation (' + api + '): ';

                if (err) {
                    utils.log(logger, 'warn', req, basicLogMessage + err.message);
                    sendError(res, err);
                } else {
                    utils.log(logger, 'info', req, basicLogMessage + 'OK');
                    redirectRequest(req, res);
                }
            });
        }
    };

    var public = function(req, res) {
        redirectRequest(req, res);
    };

    return {
        checkPermissions: checkPermissions,
        public: public
    };
})();

exports.tmf = tmf;
