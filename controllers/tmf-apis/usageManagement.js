var AccountingService = require('./../../db/schemas/accountingService'),
    async = require('async'),
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

                if (err) {

                    return callback({
                        status: 500,
                        message: 'Error validating apiKey'
                    });

                } else if (!result) {

                    return callback({
                        status: 401,
                        message: 'Invalid apikey'
                    });

                } else if (result.state !== 'COMMITTED') {

                    return callback({
                        status: 401,
                        message: 'Apikey uncommitted'
                    });

                } else {
                    return callback();
                }
            });
        }
    };

    // If the usage notification to the usage management API is successful, 
    //  it will notify the the Store with the API response
    var executePostValidation = function (req, callback) {

        var body = JSON.parse(req.body);

        var url = req.apiUrl.split('/');

        if (req.method === 'POST' && req.status === 201 && url[url.length-1] === 'usage') {
            
            storeClient.validateUsage(body, callback);
                
        } else {
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