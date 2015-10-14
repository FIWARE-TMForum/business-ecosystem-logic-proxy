var config = require('./../config.js'),
    proxy = require('./HTTPClient.js'),
    url = require('url');

// Validator to check user permissions for accessing TMForum resources
var TFM = (function() {

    // Check whether the owner role is included in the info field
    var isOwner = function (user_info, info) {
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

    // Retrieves the product belonging to a given offering
    var retrieve_product = function(user_info, offering_info, callback, callbackError) {
        var product_url = offering_info.productSpecification.href;
        var product_path = url.parse(product_url).pathname;

        var options = {
            host: config.app_host,
            port: config.app_port,
            path: product_path,
            method: 'GET',
            headers: {'content-type': 'application/json'}
        };

        var protocol = config.app_ssl ? 'https' : 'http';

        proxy.sendData(protocol, options, '', null, callback, function() {
            callbackError(400, 'The product specification of the given product offering is not valid');
        });
    };

    // The request is directly allowed without extra validation required
    var validate_allowed = function(req, user_info, callback) {
        callback();
    };

    var create_handler = function(user_info, resp, callback, callbackError) {
        if (isOwner(user_info, resp)) {
            callback();
        } else {
            callbackError(403, 'The user making the request and the specified owner are not the same user');
        }
    };

    // Validate the creation of a resource
    var validate_creation = function(req, user_info, callback, callbackError) {
        var body;
        // The request body may not be well formed
        try {
            body = JSON.parse(req.body);
        } catch (e) {
            callbackError(400, 'The resource is not a valid JSON document');
            return;
        }

        if (req.url.indexOf('productOffering') > -1) {
            retrieve_product(user_info, body, function (status, resp) {
                create_handler(user_info, JSON.parse(resp), callback, callbackError);
            }, callbackError);

        } else {
            create_handler(user_info, body, callback, callbackError);
        }
    };

    var update_handler = function(user_info, resp, callback, callbackError) {
        if (check_user(user_info, resp)) {
            callback();
        } else {
            callbackError(403, 'The user making the request is not the owner of the accessed resource');
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

        // Retrieve the resource to be updated or removed
        proxy.sendData(protocol, options, '', {}, function(status, resp) {
            var parsed_resp = JSON.parse(resp);

            // Check if the request is an offering
            if (req.url.indexOf('productOffering') > -1) {
                retrieve_product(user_info, parsed_resp, function (status, response) {
                    update_handler(user_info, JSON.parse(response), callback, callbackError);
                }, callbackError);

            } else {
                update_handler(user_info, parsed_resp, callback, callbackError);
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

    // Check that the user is the owner of the resource
    var check_user = function(user_info, resp) {
        return isOwner(user_info, resp);
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

    return {
        check_permissions: check_permissions
    };

})();

exports.TMF = TFM;
