var AccountingService = require('./../../db/schemas/accountingService'),
    async = require('async'),
    url = require('url'),
    storeClient = require('./../../lib/store').storeClient,
    utils = require('./../../lib/utils'),
    tmfUtils = require('./../../lib/tmfUtils');

var usageManagement = ( function () {

    /**
     * Check if the API Key passed is a valid API Key
     *
     * @param  {Object}   req      Incoming request.
     */
    var validateApiKey = function (req, callback) {

        var apiKey = req.get('X-API-KEY');

        if (!apiKey) {

            return callback({
                status: 401,
                message: 'Missing header "X-API-KEY"'
            });

        } else {

            AccountingService.findOne( {apiKey: apiKey}, function (err, result) {

                var res;

                if (err) {

                    res = {
                        status: 500,
                        message: 'Error validating apiKey'
                    };

                } else if (!result) {

                    res = {
                        status: 401,
                        message: 'Invalid apikey'
                    };

                } else if (result.state !== 'COMMITTED') {

                    res = {
                        status: 401,
                        message: 'Apikey uncommitted'
                    };

                } else {
                    res = null;
                }

                return callback(res);
            });
        }
    };

    // If the usage notification to the usage management API is successful, 
    //  it will notify the the Store with the API response
    var executePostValidation = function (req, callback) {

        var body = JSON.parse(req.body);

        var expr = /usage($|\/)/;

        if (req.method === 'POST' && req.status === 201 && expr.test(req.apiUrl)) {

            storeClient.validateUsage(body, callback);

        } else if (req.method === 'GET' && expr.test(req.apiUrl)){
            // Check if is needed to filter the list
            var query = url.parse(request.url, true).query;
            if (query['usageCharacteristic.value']) {
                var productValue = query['usageCharacteristic.value'];
                var filteredBody = body.filter(function(usage) {
                    var valid = false;
                    var characteristics = usage.usageCharacteristic;

                    for (var i = 0; i < characteristics.length && !valid; i++) {
                        if (characteristics[i].name.toLowerCase() == 'productid' &&
                                characteristics[i].value == productValue) {
                            valid = true;
                        }
                    }

                    return valid;
                });

                // Attach new body
                utils.updateBody(req, JSON.stringify(filteredBody));
            }
            return callback(null);
        }
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var validators = {
        'GET': [ utils.validateLoggedIn, tmfUtils.filterRelatedPartyFields ],
        'POST': [ validateApiKey ],
        'PATCH': [ utils.methodNotAllowed ],
        'PUT': [ utils.methodNotAllowed ],
        'DELETE': [ utils.methodNotAllowed ]
    };

    var checkPermissions = function (req, callback) {

        var reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        async.series(reqValidators, callback);
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };

})();

exports.usageManagement = usageManagement;