var async = require('async'),
    config = require('./../../config'),
    request = require('request'),
    tmfUtils = require('./../../lib/tmfUtils'),
    utils = require('./../../lib/utils');

var party = (function() {

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////// PRE-VALIDATION ///////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var invalidJSON = function(callback) {
        callback({
            status: 400,
            message: 'The provided body is not a valid JSON'
        });
    };

    var invalidRelatedParty = function(callback) {
        callback({
            status: 403,
            message: 'The user making the request and the specified owner are not the same user'
        });
    };

    var validateCreation = function(req, callback) {

        try {

            var party = JSON.parse(req.body);

            if (tmfUtils.isOwner(req.user, party)) {
                callback(null);
            } else {
                invalidRelatedParty(callback);
            }

        } catch (e) {
            invalidJSON(callback);
        }
    };

    var validateUpdate = function(req, callback) {

        try {

            var updatedParty = JSON.parse(req.body);

            // When relatedParty is updated, we have to ensure that the owner is still valid
            if ('relatedParty' in updatedParty && !tmfUtils.isOwner(req.user, updatedParty)) {
                invalidRelatedParty(callback);
            } else {

                var partyUrl = utils.getAPIURL(config.appSsl, config.appHost, config.endpoints.party.port, req.apiUrl);

                request(partyUrl, function (err, response, body) {

                    if (err || response.statusCode >= 400) {

                        if (response.statusCode === 404) {

                            callback({
                                status: 404,
                                message: 'The required resource does not exist'
                            });

                        } else {

                            callback({
                                status: 500,
                                message: 'The required resource could not be retrieved'
                            });
                        }

                    } else {

                        var previousParty = JSON.parse(body);

                        if (tmfUtils.isOwner(req.user, previousParty)) {
                            callback({
                                status: 403,
                                message: 'You are not allowed to update this party'
                            });
                        } else {
                            callback(null);
                        }
                    }
                });
            }

        } catch (e) {
            invalidJSON(callback);
        }
    };

    var validators = {
        'GET': [ tmfUtils.validateLoggedIn ],
        'POST': [ tmfUtils.validateLoggedIn, validateCreation ],
        'PATCH': [ tmfUtils.validateLoggedIn, validateUpdate ],
        'PUT': [ tmfUtils.validateLoggedIn, validateUpdate ],
        'DELETE': [ tmfUtils.validateLoggedIn, validateUpdate ]
    };

    var checkPermissions = function (req, callback) {
        var reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        async.series(reqValidators, callback);
    };


    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////// POST-VALIDATION //////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var executePostValidation = function(req, callback) {

        var party = JSON.parse(req.body);

        if (req.method === 'GET') {

            // Users are not allowed to list parties
            if (Array.isArray(party)) {

                callback({
                    status: 403,
                    message: 'You are not allowed to list parties'
                });

            } else {

                if (tmfUtils.isOwner(req.user, party)) {
                    callback(null);
                } else {
                    callback({
                        status: 403,
                        message: 'You are not allowed to retrieve this element'
                    })
                }
            }

        } else {
            callback(null);
        }
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };

})();

exports.party = party;