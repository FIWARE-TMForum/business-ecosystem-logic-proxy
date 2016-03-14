var config = require('./../../config'),
    url = require('url'),
    utils = require('./../../lib/utils');

var party = (function() {

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

    var validateCollectionAccess = function(req, callback) {

        switch(req.method.toUpperCase()) {

            case 'GET':

                callback({
                    status: 403,
                    message: 'Parties cannot be listed'
                });

                break;

            case 'POST':

                validateCreation(req, callback);
                break;

            default:
                callback(null);
        }
    };

    var validateResourceAccess = function(req, userId, callback) {
        if (req.user.id === userId) {
            callback(null);
        } else {
            callback({
                status: 403,
                message: 'You are not allowed to access this resource'
            });
        }
    };

    var checkPermissions = function (req, callback) {

        utils.validateLoggedIn(req, function(err) {

            if (err) {
                callback(err);
            } else {

                var individualsPattern = new RegExp('^/' + config.endpoints.party.path +
                        '/api/partyManagement/v2/individual(/([^/]*))?$');
                var apiPath = url.parse(req.apiUrl).pathname;

                var regexResult = individualsPattern.exec(apiPath);

                if (regexResult) {

                    var userId = regexResult[2];

                    if (!userId) {
                        validateCollectionAccess(req, callback);
                    } else {
                        validateResourceAccess(req, userId, callback);
                    }
                } else {
                    callback({
                        status: 404,
                        message: 'API not implemented'
                    });
                }
            }
        });
    };

    return {
        checkPermissions: checkPermissions
    };

})();

exports.party = party;