var async = require('async'),
    utils = require('./../../lib/utils'),
    config = require('./../../config.js'),
    logger = require('./../../lib/logger').logger.getLogger('TMF'),

    rssClient = require('./../../lib/rss').rssClient;

var rss = (function () {

    var validateProvider = function (req, callback) {
        utils.log(logger, 'info', req, "Validating RSS provider");

        // Hide private APIs
        if (req.apiUrl.indexOf('rss/aggregators') >= 0 || req.apiUrl.indexOf('rss/providers') >= 0) {
            return callback({
                status: 403,
                message: 'This API is private'
            });
        }

        // Only sellers are allowed to access the RSS API
        if (!utils.hasRole(req.user, config.oauth2.roles.seller)) {
            return callback({
                status: 403,
                message: 'You are not authorized to access the RSS API'
            });
        }

        // Check if the provider object has been already created
        rssClient.createProvider(req.user, function(err) {
            if (err) {
                return callback({
                    status: 500,
                    message: 'An unexpected error in the RSS API prevented your request to be processed'
                });
            }
            callback();
        });
    };

    var validateContentRequest = function(req, callback) {
        var body;

        // Hide CDRs API
        if (req.apiUrl.indexOf('rss/cdrs') >= 0) {
            return callback({
                status: 403,
                message: 'This API can only be accessed with GET requests'
            });
        }

        try {
            body = JSON.parse(req.body);
        } catch (e) {
            return callback({
                status: 400,
                message: 'The provided body is not a valid JSON'
            });
        }

        // Include the revenue model as aggregator value when creating RS models
        if (req.apiUrl.indexOf('rss/models') >= 0) {
            body.aggregatorValue = config.revenueModel;
            utils.updateBody(req, body);
        }
        callback();
    };

    var validators = {
        'GET': [utils.validateLoggedIn, validateProvider],
        'POST': [utils.validateLoggedIn, validateProvider, validateContentRequest],
        'PUT': [utils.validateLoggedIn, validateProvider, validateContentRequest],
        'DELETE': [utils.validateLoggedIn, validateProvider],
        'PATCH': [utils.methodNotAllowed]
    };

    var checkPermissions = function (req, callback) {

        var reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        async.series(reqValidators, callback);
    };

    var executePostValidation = function(req, callback) {
        logger.info("Executing RSS post validation");
        if (req.method == 'GET' && req.apiUrl.indexOf('rss/models') >= 0) {
            // Check if the models list is empty
            try {
                body = JSON.parse(req.body);
            } catch (e) {
                // If an error parsing the body occurs this is a failure in the
                // request so the error is retransmitted
                return callback();
            }

            // If the models list is empty create the default revenue model
            if (!body.length) {
                rssClient.createDefaultModel(req.user, function(err, response) {
                    if (err) {
                        return callback(err);
                    }

                    body.push(JSON.parse(response.body));
                    utils.updateBody(req, body);
                    callback();
                });
            } else {
                callback();
            }
        } else {
            callback();
        }
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };
})();

exports.rss = rss;
