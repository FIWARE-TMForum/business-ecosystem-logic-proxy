var config = require('./../config.js'),
    proxy = require('./HTTPClient.js');

var log = require('./logger').logger.getLogger("IDM-Client");

// Validator to check user permissions for accessing TMForum resources
var TFM = (function() {

    // The request is directly allowed without extra validation required
    var validate_allowed = function(req, user_info, callback) {
        callback();
    };

    // Validate the creation of a resource
    var validate_creation = function(req, user_info, callback, callbackError) {
        var body = JSON.parse(req.body);
        if (isOwner(body, user_info)) {
            callback();
        } else {
            callbackError();
        }
    };

    // Validate the modification of a resource
    var validate_update = function(req, user_info, callback, callbackError) {
        var options = {
            host: config.app_host,
            port: config.app_port,
            path: req.url,
            method: 'GET',
            headers: proxy.getClientIp(req, req.headers)
        };

        var protocol = config.app_ssl ? 'https' : 'http';
        var res = {};

        // Retrieve the resource to be updated or removed
        proxy.sendData(protocol, options, '', res, function(status, resp) {
            if (check_user(user_info, resp)) {
                callback();
            } else {
                callbackError();
            }
        });
    };

    var validators = {
        'GET': validate_allowed,
        'POST': validate_creation,
        'PATCH': validate_update,
        'PUT': validate_update,
        'DELETE': validate_update
    };

    var check_permissions = function (req, user_info, callback, callbackError) {
        var admin = false;

        // Search for provider role
        for (var i = 0; i < user_info.roles.length && !admin; i++) {
            if (user_info.roles[i].id === config.account_provider_role) {
                admin = true;
            }
        }

        // Check if the user is admin of the application
        if (admin) {
            callback();
        } else {
            validators[req.method](req, user_info, callback, callbackError);
        }
    };

    // Check whether the owner role is included in the info field
    var isOwner = function (info, user_info) {
        var status = false;
        if (info.relatedParty) {
            var parties = info.relatedParty;
            var i = 0;

            while(!status && i < parties.length) {
                var party = parties[i];

                if (party.role == 'Owner' && party.id == user_info.id) {
                    status = true
                }
                i++;
            }
        }

        return status;
    };

    // Check that the user is the owner of the resource
    var check_user = function(user_info, resp) {
        return isOwner(JSON.parse(resp, user_info));
    };

    return {
        check_permissions: check_permissions
    };

})();

exports.TMF = TFM;
