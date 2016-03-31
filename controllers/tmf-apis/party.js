var async = require('async'),
    config = require('./../../config'),
    url = require('url'),
    utils = require('./../../lib/utils');

var party = (function() {

    var validateAllowed = function(req, callback) {
        callback(null);
    };

    var validateCreation = function(req, callback) {

        try {

            var party = JSON.parse(req.body);

            if (party.id && party.id === req.user.id) {
                callback(null);
            } else {
                callback({
                    status: 403,
                    message: 'Provided party ID and request user ID mismatch'
                });
            }

        } catch (e) {
            callback({
                status: 400,
                message: 'The provided body is not a valid JSON'
            });
        }
    };

    var validateUpdate = function(req, callback) {

        var individualsPattern = new RegExp('^/' + config.endpoints.party.path +
            '/api/partyManagement/v2/individual(/([^/]*))?$');
        var apiPath = url.parse(req.apiUrl).pathname;

        var regexResult = individualsPattern.exec(apiPath);

        if (!regexResult || !regexResult[2]) {
            callback({
                status: 404,
                message: 'The given path is invalid'
            });
        } else {

            // regexResult[2] contains the user name
            if (req.user.id === regexResult[2]) {
                callback(null);
            } else {
                callback({
                    status: 403,
                    message: 'You are not allowed to access this resource'
                });
            }
        }
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var validators = {
        'GET': [ validateAllowed ],
        'POST': [ utils.validateLoggedIn, validateCreation ],
        'PATCH': [ utils.validateLoggedIn, validateUpdate ],
        'PUT': [ utils.validateLoggedIn, validateUpdate ],
        'DELETE': [ utils.validateLoggedIn, validateUpdate ]
    };

    var checkPermissions = function (req, callback) {

        var reqValidators = [];

        if (req.method in validators) {
            for (var i in validators[req.method]) {
                reqValidators.push(validators[req.method][i].bind(this, req));
            }

            async.series(reqValidators, callback);

        } else {
            callback({
                status: 405,
                message: 'Method not allowed'
            })
        }
    };

    return {
        checkPermissions: checkPermissions
    };

})();

exports.party = party;