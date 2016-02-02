var config = require('./../config'),

    // TMF APIs
    catalog = require('./tmf-apis/catalog').catalog,
    inventory = require('./tmf-apis/inventory').inventory,
    ordering = require('./tmf-apis/ordering').ordering,
    onboarding = require('./tmf-apis/onboarding').onboarding,
    charging = require('./tmf-apis/charging').charging,
    
    // Other dependencies
    httpClient = require('./../lib/httpClient'),
    utils = require('./../lib/utils'),
    log = require('./../lib/logger').logger.getLogger('TMF'),
    url = require('url');

var tmf = (function() {

    var apiControllers = {};
    apiControllers[config.endpoints.catalog.path] = catalog;
    apiControllers[config.endpoints.ordering.path] = ordering;
    apiControllers[config.endpoints.inventory.path] = inventory;
    apiControllers[config.endpoints.onboarding.path] = onboarding;
    apiControllers[config.endpoints.charging.path] = charging;

    var getAPIName = function(apiPath) {
        return apiPath.split('/')[1];
    };

    var sendError = function(res, err) {

        var status = err.status;
        var errMsg = err.message;

        log.warn(errMsg);
        res.status(status);
        res.send({error: errMsg});
        res.end();
    };

    var redirRequest = function (req, res) {

        if (req.user) {
            log.info('Request with auth credentials');
            utils.attachUserHeaders(req.headers, req.user);
        } else {
            log.info('Request without auth credentials');
        }

        var protocol = config.appSsl ? 'https' : 'http';
        var api = getAPIName(req.apiPath);

        var options = {
            host: config.appHost,
            port: utils.getAPIPort(api),
            path: req.apiPath,
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
                    if (err) {
                        sendError(res, err);
                    } else {
                        callback();
                    }
                });
            }
        }

        httpClient.proxyRequest(protocol, options, req.body, res, postAction);
    };

    var checkPermissions = function(req, res) {

        var api = getAPIName(req.apiPath);

        if (apiControllers[api] === undefined) {
            sendError(res, {
                status: 404,
                message: 'Path not found'
            });
        } else {
            apiControllers[api].checkPermissions(req, function(err) {
                if (err) {
                    sendError(res, err);
                } else {
                    redirRequest(req, res);
                }
            });
        }
    };

    var public = function(req, res) {
        redirRequest(req, res);
    };

    return {
        checkPermissions: checkPermissions,
        public: public
    }
})();

exports.tmf = tmf;
