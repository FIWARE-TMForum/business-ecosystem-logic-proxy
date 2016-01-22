var config = require('./../config.js'),
    url = require('url');

exports.attachUserHeaders = function(headers, userInfo) {
    headers['Authorization'] = 'Bearer ' + userInfo.accessToken;
    headers['X-Nick-Name'] = userInfo.id;
    headers['X-Display-Name'] = userInfo.displayName;
    headers['X-Roles'] = '';

    var roles = [
        config.oauth2.roles.admin,
        config.oauth2.roles.seller,
        config.oauth2.roles.customer
    ];

    for (var i = 0; i < userInfo.roles.length; i++) {
        var role = userInfo.roles[i].name.toLowerCase();
        if (roles.indexOf(role) > -1) {
            headers['X-Roles'] += role + ',';
        }
    }
    // TODO: Parse organizations to send them in an appropriate way
    // headers['X-Organizations'] = userInfo.organizations;
};

exports.proxiedRequestHeaders = function(req) {

    // Copy the headers (the original headers are not overwritten)
    var headers = JSON.parse(JSON.stringify(req.headers));
    var FORWARDED_HEADER_NAME = 'x-forwarded-for';
    var userIp = req.connection.remoteAddress;

    headers[FORWARDED_HEADER_NAME] = headers[FORWARDED_HEADER_NAME] ? 
            headers[FORWARDED_HEADER_NAME] + ',' + userIp : 
            userIp;

    return headers;
};

exports.getAPIPort = function(api) {

    // Check accessed API
    var ports = {};
    ports[config.endpoints.catalog.path] = config.endpoints.catalog.port;
    ports[config.endpoints.ordering.path] = config.endpoints.ordering.port;
    ports[config.endpoints.inventory.path] = config.endpoints.inventory.port;
    ports[config.endpoints.charging.path] = config.endpoints.charging.port;
    ports[config.endpoints.rss.path] = config.endpoints.rss.port;

    // Return related port
    return ports[api];
};

exports.getAuthToken = function(headers) {

    var authToken = headers['x-auth-token'];
    
    // Get access token
    if (authToken === undefined) {

        var authHeader = headers['authorization'];

        if (authHeader !== undefined) {
            var spToken = authHeader.split(' ');
            var tokenType = spToken[0].toLowerCase();

            // Token is only set when the header type is Bearer
            // Basic Authorization tokes are NOT allowed
            var VALID_TOKEN_TYPE = 'bearer';

            if (tokenType === VALID_TOKEN_TYPE) {
                authToken = spToken[1];
            } else {
                throw {
                    name: 'InvalidAuthorizationTokenException',
                    message: 'Invalid Auth-Token type (' + tokenType + ')'
                };
            }

        } else {
            throw {
                name: 'AuthorizationTokenNotFound',
                message: 'Auth-token not found in request headers'
            };
        }
    }

    return authToken;
};

exports.sendUnauthorized = function(res, errMsg) {
    var authHeader = 'IDM uri = ' + config.oauth2.server;
    res.set('WWW-Authenticate', authHeader);
    res.status(401);
    res.send({ error: errMsg });
}

exports.getRefererPath = function(req) {

    var refererPath = '/';
    var hostName = req.hostname;
    var port = req.app.settings.port;
    var host = hostName + ':' + port;
    var referer = req.headers['referer'];

    if (referer) {
        var parsedReferer = url.parse(referer);

        if (parsedReferer.host == host) {
            refererPath = parsedReferer.path;
        }
    }

    return refererPath;
};