var config = require('./../config'),

    // TMF APIs
    catalog = require('./tmf-apis/catalog').catalog,
    inventory = require('./tmf-apis/inventory').inventory,
    ordering = require('./tmf-apis/ordering').ordering,
    
    // Other dependencies
    httpClient = require('./../lib/httpClient'),
    utils = require('./../lib/utils'),
    log = require('./../lib/logger').logger.getLogger("TMF"),
    url = require('url');

var tmf = (function() {

    var apiControllers = {};
    apiControllers[config.endpoints.catalog.path] = catalog;
    apiControllers[config.endpoints.ordering.path] = ordering;
    apiControllers[config.endpoints.inventory.path] = inventory;

    var sendError = function(res, status, errMsg) {
        log.warn(errMsg);
        res.status(status);
        res.send({error: errMsg});
        res.end();
    }

    var redirRequest = function (req, res) {

        if (req.user) {
            log.info('Access-token OK. Redirecting to app...');
            utils.attachUserHeaders(req.headers, req.user);
        } else {
            log.info('Public path. Redirecting to app...');
        }

        var protocol = config.appSsl ? 'https' : 'http';

        var options = {
            host: config.appHost,
            port: utils.getAppPort(req),
            path: req.url,
            method: req.method,
            headers: utils.proxiedRequestHeaders(req)
        };

        httpClient.proxyRequest(protocol, options, req.body, res);
    };

    var checkPermissions = function(req, res) {

        var api = url.parse(req.url).path.split('/')[1];

        if (apiControllers[api] === undefined) {
            sendError(res, 404, 'Path not found');
        } else {
            apiControllers[api].checkPermissions(req, function() {
                redirRequest(req, res);
            }, function(status, errMsg) {
                sendError(res, status, errMsg);
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