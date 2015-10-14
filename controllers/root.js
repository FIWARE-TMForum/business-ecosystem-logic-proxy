var config = require('./../config.js'),
    proxy = require('./../lib/HTTPClient.js'),
    IDM = require('./../lib/idm.js').IDM,
    TMF = require('./../lib/tmf.js').TMF,
    AZF = require('./../lib/azf.js').AZF;

var log = require('./../lib/logger').logger.getLogger("Root");

var Root = (function() {

    var sendUnauthorized = function(res, msg) {
        log.error(msg);
        var auth_header = 'IDM uri = ' + config.account_host;
        res.set('WWW-Authenticate', auth_header);
        res.send(401, msg);
    };

    var pep = function(req, res) {
    	
    	var auth_token = req.headers['x-auth-token'];

        if (auth_token === undefined && req.headers['authorization'] !== undefined) {
            var sp_token = req.headers['authorization'].split(' ');
            var token_type = sp_token[0].toLowerCase();

            // Check if the token type is valid
            if (token_type !== 'basic' && token_type !== 'bearer') {
                sendUnauthorized(res, 'The provided auth-token does not have a valid type');
            }

            auth_token = sp_token[1];

            // If the access token is of type basic it is needed to decode it
            if (token_type === 'basic') {
                auth_token = new Buffer(header_auth, 'base64').toString();
            }
        }

    	if (auth_token === undefined) {
            sendUnauthorized(res, 'Auth-token not found in request header');
    	} else {

            if (config.magic_key && config.magic_key === auth_token) {
                var options = {
                    host: config.app_host,
                    port: config.app_port,
                    path: req.url,
                    method: req.method,
                    headers: proxy.getClientIp(req, req.headers)
                };
                proxy.sendData('http', options, req.body, res);
                return;

            }

    		IDM.check_token(auth_token, function (user_info) {

                if (config.azf.enabled) {
                    var action = req.method;
                    var resource = req.url.substring(1, req.url.length);

                    AZF.check_permissions(auth_token, user_info, resource, action, function () {

                        // Check TMF Permissions
                        TMF.check_permissions(req, user_info, function() {
                            redir_request(req, res, user_info);
                        }, function(status, errMsg) {
                            log.error(errMsg);
                            res.send(status, errMsg);
                        });

                    }, function (status, e) {
                        if (status === 401) {
                            sendUnauthorized(res, 'User access-token not authorized');
                        } else {
                            log.error('Error in AZF communication ', e);
                            res.send(503, 'Error in AZF communication');
                        }

                    });
                } else {
                    // Check TMF Permissions
                    TMF.check_permissions(req, user_info, function() {
                        redir_request(req, res, user_info);
                    }, function(status, errMsg) {
                        log.error(errMsg);
                        res.send(status, errMsg);
                    });
                }


    		}, function (status, e) {
    			if (status === 404) {
                    sendUnauthorized(res, 'User access-token not authorized');
                } else {
                    log.error('Error in IDM communication ', e);
                    res.send(503, 'Error in IDM communication');
                }
    		});
    	};	
    };

    var public = function(req, res) {
        redir_request(req, res);
    };

    var redir_request = function (req, res, user_info) {

        if (user_info) {

            log.info('Access-token OK. Redirecting to app...');

            if (config.tokens_engine === 'keystone') {
                req.headers['X-Nick-Name'] = user_info.token.user.id;
                req.headers['X-Display-Name'] = user_info.token.user.id;
                req.headers['X-Roles'] = user_info.token.roles;
                req.headers['X-Organizations'] = user_info.token.project;
            } else {
                req.headers['X-Nick-Name'] = user_info.id;
                req.headers['X-Display-Name'] = user_info.displayName;
                req.headers['X-Roles'] = user_info.roles;
                req.headers['X-Organizations'] = user_info.organizations;
            }
        } else {
            log.info('Public path. Redirecting to app...');
        }

        var protocol = config.app_ssl ? 'https' : 'http';

        var options = {
            host: config.app_host,
            port: config.app_port,
            path: req.url,
            method: req.method,
            headers: proxy.getClientIp(req, req.headers)
        };
        proxy.sendData(protocol, options, req.body, res);
    };

    return {
        pep: pep,
        public: public
    }
})();

exports.Root = Root;