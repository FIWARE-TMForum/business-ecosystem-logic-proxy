var config = require('./../config'),

    // TMF APIs
    catalog = require('./tmf-apis/catalog').catalog,
    inventory = require('./tmf-apis/inventory').inventory,
    ordering = require('./tmf-apis/ordering').ordering,
    charging = require('./tmf-apis/charging').charging,
    
    // Other dependencies
    httpClient = require('./../lib/httpClient'),
    utils = require('./../lib/utils'),
    logger = require('./../lib/logger').logger.getLogger('TMF'),
    url = require('url');

var tmf = (function() {

    var apiControllers = {};
    apiControllers[config.endpoints.catalog.path] = catalog;
    apiControllers[config.endpoints.ordering.path] = ordering;
    apiControllers[config.endpoints.inventory.path] = inventory;
    apiControllers[config.endpoints.charging.path] = charging;

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

        var protocol = config.appSsl ? 'https' : 'http';
        var api = getAPIName(req.apiUrl);

        var options = {
            host: config.appHost,
            port: utils.getAPIPort(api),
            path: req.apiUrl,
            method: req.method,
            headers: utils.proxiedRequestHeaders(req)
        };

        // The proxy prefix must be removed!!
        var postAction = null;

        if (apiControllers[api] !== undefined && apiControllers[api].executePostValidation) {

            postAction = function(result, callback) {

                result.user = req.user;
                result.method = req.method;
                result.path = req.path;

                apiControllers[api].executePostValidation(result, function(err) {

                    var basicLogMessage = 'Post-Validation (' + api + '): ';

                    if (err) {
                        utils.log(logger, 'warn', req, basicLogMessage + err.message);
                        sendError(res, err);
                    } else {
                        utils.log(logger, 'info', req, basicLogMessage + 'OK');
                        callback();
                    }
                });
            };
        }

        httpClient.proxyRequest(protocol, options, req.body, res, postAction);
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

                var basicLogMessage = 'Check Permissions (' + api + '): ';

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