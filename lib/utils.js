/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the business-ecosystem-logic-proxy of the
 * Business API Ecosystem
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var config = require('./../config.js'),
    url = require('url');

/**
 * Logs a message using a specific logger
 * @param {Object} logger The logger to be used
 * @param {String} level The level of the message
 * @param {Object} req The request that generates the log message
 * @param {String} message The actual message to be logged
 */
exports.log = function(logger, level, req, message) {

    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    var user = req.user ? req.user.id : 'Anonymous';

    logger[level]('%s - %s - %s - %s: %s - %s', req.id, ip, user, req.method, req.url, message);
};

/**
 * Attach user headers to a set of headers so that the underlying system can obtain
 * information of the user who is making the request without effort
 * @param {Object} headers
 * @param {Object} userInfo
 */
exports.attachUserHeaders = function(headers, userInfo) {
    headers['Authorization'] = 'Bearer ' + userInfo.accessToken;
    headers['X-Nick-Name'] = userInfo.id;
    headers['X-Email'] = userInfo.email;
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

/**
 * Returns the headers to be included in a proxyed request
 * @param {Object} req
 */
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

/**
 * Returns the actual port of an API given its path
 * @param {String} api The path of the API
 * @returns {Number} The port where the API is actually running
 */
exports.getAPIPort = function(api) {

    // Check accessed API
    var ports = {};
    ports[config.endpoints.catalog.path] = config.endpoints.catalog.port;
    ports[config.endpoints.ordering.path] = config.endpoints.ordering.port;
    ports[config.endpoints.inventory.path] = config.endpoints.inventory.port;
    ports[config.endpoints.party.path] = config.endpoints.party.port;
    ports[config.endpoints.customer.path] = config.endpoints.customer.port;
    ports[config.endpoints.billing.path] = config.endpoints.billing.port;
    ports[config.endpoints.charging.path] = config.endpoints.charging.port;
    ports[config.endpoints.rss.path] = config.endpoints.rss.port;
    ports[config.endpoints.usage.path] = config.endpoints.usage.port;

    // Return related port
    return ports[api];
};

/**
 * Generates a valid URL based on the given parameters
 * @param {Boolean} ssl
 * @param {String} host
 * @param {Number} port
 * @param {String} path
 * @returns {string} A valid URL
 */
exports.getAPIURL = function(ssl, host, port, path) {

    if (path[0] != '/') {
        path = '/' + path;
    }

    return (ssl ? 'https' : 'http') + '://' + host + ':' + port + path;
};

/**
 * This function looks for an authorization token. If an authorization token is not included,
 * the AuthorizationTokenNotFound is thrown. If the authorization token is invalid, the
 * InvalidAuthorizationException is thrown.
 * @param {Object} headers
 * @returns {String} The authorization token included in the request
 */
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

/**
 * When the user is required to be authenticated to call a specific resource, this function
 * will set the appropriate headers and will send a JSON with the specified message
 * @param {Object} res
 * @param {String} errMsg The error to be returned to the user.
 */
exports.sendUnauthorized = function(res, errMsg) {
    var authHeader = 'IDM uri = ' + config.oauth2.server;
    res.set('WWW-Authenticate', authHeader);
    res.status(401);
    res.send({ error: errMsg });
};

/**
 * Returns the last path visited by the user
 * @param {Object} req
 * @returns {String} The last path visited by the user
 */
exports.getCameFrom = function(req) {

    var refererPath = '/';
    var hostName = req.hostname;
    var port = req.app.settings.port;
    var host = hostName + ':' + port;
    var referer = req.headers['referer'];
    var returnTo = req.query['came_from'];

    if (returnTo) {
        refererPath = returnTo;
    } else if (referer) {
        var parsedReferer = url.parse(referer);

        if (parsedReferer.host == host) {
            refererPath = parsedReferer.path;
        }
    }

    return refererPath;
};

/**
 * Updates a request and replace the body of a request/response with a new one.
 * The header `Content-Length` is updated accordingly
 * @param {Object} req
 * @param {Object} newBody
 */
exports.updateBody = function(req, newBody) {
    req.body = JSON.stringify(newBody);
    // When the body is updated, the content-length field has to be updated too
    req.headers['content-length'] = Buffer.byteLength(req.body);
};

/**
 * Raises a 405 error (METHOD NOT ALLOWED).
 * @param {Object} req
 * @param {Function} callback
 */
exports.methodNotAllowed = function(req, callback) {
    callback({
        status: 405,
        message: 'The HTTP method ' + req.method + ' is not allowed in the accessed API'
    });
};

/**
 * Checks if the request user is currently logged in.
 * @param {Object} req
 * @param {Function} callback
 */
exports.validateLoggedIn = function(req, callback) {
    if (req.user) {
        callback();
    } else {
        callback({
            status: 401,
            message: 'You need to be authenticated to perform this request'
        });
    }
};

/**
 * Checks if the given `user` has the role `admin`.
 * @param {Object} user
 */
exports.isAdmin = function (user) {
    return this.hasRole(user, config.oauth2.roles.admin);
};

/**
 * Checks if the given `user` has a role labeled as the given `roleName`.
 * @param {Object} user
 * @param {String} roleName
 */
exports.hasRole = function (user, roleName) {
    return user != null && 'roles' in user && user.roles.some(function (role) {
        return role.name.toLowerCase() === roleName.toLowerCase();
    });
};
