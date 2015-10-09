var config = require('./../config.js'),
    proxy = require('./HTTPClient.js');

var log = require('./logger').logger.getLogger("IDM-Client");

// Validator to check user permissions for accessing TMForum resources
var TFM = (function() {

    var check_permissions = function (req, user_info, callback, callbackError) {
        if (req.method !== 'GET' && req.method !== 'POST') {
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
        } else {
            callback();
        }
    };

    // Check that the user is the owner of the resource
    var check_user = function(user_info, resp) {
        var status = false;
        var info = JSON.parse(resp);

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
    }

    return {
        check_permissions: check_permissions
    };
})();

exports.TMF = TFM;
