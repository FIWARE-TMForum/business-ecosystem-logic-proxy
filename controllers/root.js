var config = require('./../config.js'),
    httpClient = require('./../lib/httpClient.js'),
    idm = require('./../lib/idm.js').idm,
    tmf = require('./../lib/tmf.js').tmf,
    utils = require('./../lib/utils/utils.js'),
    AZF = require('./../lib/azf.js').AZF;
    log = require('./../lib/logger').logger.getLogger("Root");

var root = (function() {

    // Auxilar Functions
    var sendUnauthorized = function(res, msg) {
        log.warn(msg);
        var authHeader = 'IDM uri = ' + config.accountHost;
        res.set('WWW-Authenticate', authHeader);
        res.send(401, { error: msg });
    };

    var redirRequest = function (req, res, userInfo) {

        if (userInfo) {
            log.info('Access-token OK. Redirecting to app...');
            utils.attachUserHeaders(req.headers, userInfo);
        } else {
            log.info('Public path. Redirecting to app...');
        }

        var protocol = config.appSsl ? 'https' : 'http';

        var options = {
            host: config.appHost,
            port: utils.getAppPort(req),
            path: req.url,
            method: req.method,
            headers: utils.proxiedRequestHeaders(req)
        };

        httpClient.proxyRequest(protocol, options, req.body, res);
    };

    // Refactor TMF function here
    var checkTMFPermissions = function(req, res, userInfo) {
        tmf.checkPermissions(req, userInfo, function() {
            redirRequest(req, res, userInfo);
        }, function(status, errMsg) {
            log.error(errMsg);
            res.send(status, { error: errMsg });
        });
    };

    var pep = function(req, res) {
    	
    	var authToken = req.headers['x-auth-token'];
        var authErrorMessage = '';  // Default error message

        // Get access token
        if (authToken === undefined) {

            var authHeader = req.headers['authorization'];

            if (authHeader !== undefined) {
                var spToken = authHeader.split(' ');
                var tokenType = spToken[0].toLowerCase();

                // Token is only set when the header type is Bearer
                // Basic Authorization tokes are NOT allowed
                var VALID_TOKEN_TYPE = 'bearer';

                if (tokenType === VALID_TOKEN_TYPE) {
                    authToken = spToken[1];
                } else {
                    authErrorMessage = 'The type of the provided auth-token (' 
                        + tokenType + ') does not have a valid type (' + VALID_TOKEN_TYPE + ')';
                }

            } else {
                authErrorMessage = 'Auth-token not found in request headers';
            }
        }

        // Request can only made when the authorization token is defined
        if (authToken === undefined) {
            sendUnauthorized(res, authErrorMessage);
        } else {

            // If the received auth token is the magic key we are not required to check
            // the credentials. The request is just proxied to the final server
            if (config.magicKey && config.magicKey === authToken) {
                
                var options = {
                    host: config.appHost,
                    port: utils.getAppPort(req),
                    path: req.url,
                    method: req.method,
                    headers: utils.proxiedRequestHeaders(req)
                };

                httpClient.proxyRequest('http', options, req.body, res);

            } else {

                idm.checkToken(authToken, function (userInfo) {

                    // The function to be called if the token is valid

                    if (config.azf.enabled) {
                        var action = req.method;
                        var resource = req.url.substring(1, req.url.length);

                        AZF.check_permissions(authToken, userInfo, resource, action, function () {
                            checkTMFPermissions(req, res, userInfo);
                        }, function (status, e) {
                            if (status === 401) {
                                sendUnauthorized(res, 'User access-token not authorized');
                            } else {
                                log.error('Error in AZF communication ', e);
                                res.send(503, 'Error in AZF communication');
                            }
                        });
                    } else {
                        checkTMFPermissions(req, res, userInfo);
                    }

            }, function (status, e) {

                    // The function to be called if the token is not valid

                    if (status === 404) {
                        log.warn('Invalid access-token', authToken);
                        sendUnauthorized(res, 'Invalid access-token');
                    } else {
                        log.error('Error in IDM communication ', e);
                        res.send(503, 'Error in IDM communication');
                    }
                });
            }
        }
    };

    var public = function(req, res) {
        redirRequest(req, res);
    };

    return {
        pep: pep,
        public: public
    }
})();

exports.root = root;