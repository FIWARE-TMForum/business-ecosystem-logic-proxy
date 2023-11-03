/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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

const config = require('./../config.js');
const url = require('url');

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
    if (config.propagateToken) {
        headers['Authorization'] = 'Bearer ' + userInfo.accessToken;
    }

    headers['X-Nick-Name'] = userInfo.id;
    headers['X-Email'] = userInfo.email;
    headers['X-Display-Name'] = userInfo.displayName;
    headers['X-Roles'] = '';
    headers['X-Actor'] = userInfo.userNickname ? userInfo.userNickname : userInfo.id;
    headers['X-Ext-Name'] = '';

    if (!userInfo.userNickname) {
        headers['X-Ext-Name'] = userInfo.username;
    }

    if (userInfo.agreedOnTerms) {
        headers['X-Terms-Accepted'] = 'True';
    }

    if (userInfo.displayName === '') {
        headers['X-Display-Name'] = userInfo.username;
    }

    if (userInfo.idp) {
        headers['X-IDP-ID'] = userInfo.idp;

        // If allow local EORIs the IDP ID is the organization trading name
        if (userInfo.idp == 'local' && userInfo.userNickname != null && config.allowLocalEORI) {
            headers['X-IDP-ID'] = userInfo.displayName;
        }
    }

    if (userInfo.issuerDid) {
        headers['X-ISSUER-DID'] = userInfo.issuerDid;
    }

    var roles = [config.oauth2.roles.admin, config.oauth2.roles.seller, config.oauth2.roles.customer];

    for (var i = 0; i < userInfo.roles.length; i++) {
        var role = userInfo.roles[i].name.toLowerCase();
        if (roles.indexOf(role) > -1) {
            headers['X-Roles'] += role + ',';
        }
    }
};

/**
 * Returns the headers to be included in a proxyed request
 * @param {Object} req
 */
exports.proxiedRequestHeaders = function(req) {
    // Copy the headers (the original headers are not overwritten)
    // FIXME: Remove this as soon as we support long tokens
    req.headers['authorization'] = undefined;


    var headers = JSON.parse(JSON.stringify(req.headers));
    var FORWARDED_HEADER_NAME = 'x-forwarded-for';
    var userIp = req.connection.remoteAddress;

    headers[FORWARDED_HEADER_NAME] = headers[FORWARDED_HEADER_NAME]
        ? headers[FORWARDED_HEADER_NAME] + ',' + userIp
        : userIp;

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
    ports[config.endpoints.management.path] = config.endpoints.management.port;
    ports[config.endpoints.sla.path] = config.endpoints.sla.port;
    ports[config.endpoints.reputation.path] = config.endpoints.reputation.port;
    ports[config.endpoints.catalog.path] = config.endpoints.catalog.port;
    ports[config.endpoints.ordering.path] = config.endpoints.ordering.port;
    ports[config.endpoints.inventory.path] = config.endpoints.inventory.port;
    ports[config.endpoints.party.path] = config.endpoints.party.port;
    ports[config.endpoints.customer.path] = config.endpoints.customer.port;
    ports[config.endpoints.billing.path] = config.endpoints.billing.port;
    ports[config.endpoints.charging.path] = config.endpoints.charging.port;
    ports[config.endpoints.rss.path] = config.endpoints.rss.port;
    ports[config.endpoints.usage.path] = config.endpoints.usage.port;
    ports[config.endpoints.resource.path] = config.endpoints.resource.port;
    ports[config.endpoints.service.path] = config.endpoints.service.port;

    // Return related port
    return ports[api];
};

/**
 * Returns the actual host of an API given its path
 * @param {String} api The path of the API
 * @returns {String} The host where the API is actually running
 */
exports.getAPIHost = function(api) {
    // Check accessed API
    var hosts = {};
    hosts[config.endpoints.management.path] = config.endpoints.management.host;
    hosts[config.endpoints.sla.path] = config.endpoints.sla.host;
    hosts[config.endpoints.reputation.path] = config.endpoints.reputation.host;
    hosts[config.endpoints.catalog.path] = config.endpoints.catalog.host;
    hosts[config.endpoints.ordering.path] = config.endpoints.ordering.host;
    hosts[config.endpoints.inventory.path] = config.endpoints.inventory.host;
    hosts[config.endpoints.party.path] = config.endpoints.party.host;
    hosts[config.endpoints.customer.path] = config.endpoints.customer.host;
    hosts[config.endpoints.billing.path] = config.endpoints.billing.host;
    hosts[config.endpoints.charging.path] = config.endpoints.charging.host;
    hosts[config.endpoints.rss.path] = config.endpoints.rss.host;
    hosts[config.endpoints.usage.path] = config.endpoints.usage.host;
    hosts[config.endpoints.resource.path] = config.endpoints.resource.host;
    hosts[config.endpoints.service.path] = config.endpoints.service.host;

    // Return related port
    return hosts[api];
};

exports.getAPIProtocol = function(api) {
    var protocols = {};

    protocols[config.endpoints.management.path] = config.endpoints.management.appSsl;
    protocols[config.endpoints.catalog.path] = config.endpoints.catalog.appSsl;
    protocols[config.endpoints.ordering.path] = config.endpoints.ordering.appSsl;
    protocols[config.endpoints.inventory.path] = config.endpoints.inventory.appSsl;
    protocols[config.endpoints.party.path] = config.endpoints.party.appSsl;
    protocols[config.endpoints.customer.path] = config.endpoints.customer.appSsl;
    protocols[config.endpoints.billing.path] = config.endpoints.billing.appSsl;
    protocols[config.endpoints.charging.path] = config.endpoints.charging.appSsl;
    protocols[config.endpoints.rss.path] = config.endpoints.rss.appSsl;
    protocols[config.endpoints.usage.path] = config.endpoints.usage.appSsl;
    protocols[config.endpoints.resource.path] = config.endpoints.resource.appSsl;
    protocols[config.endpoints.service.path] = config.endpoints.service.appSsl;

    // Return related port
    return protocols[api] ? 'https' : 'http';
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
    if (path[0] !== '/') {
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
 * When an unexpected error happens this function build the appropriate error response
 * @param {Object} res express response object
 * @param {String} errMsg The error to be returned to the user
 */
exports.sendUnexpectedError = function(res, errMsg) {
    res.status(500);
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

        if (parsedReferer.host === host) {
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
 * Updates a response object JSON
 * The header `Content-Length` is updated accordingly
 * @param {*} res 
 * @param {*} nweBody 
 */
exports.updateResponseBody = function(res, newBody) {
    res.body = newBody;
    // When the body is updated, the content-length field has to be updated too
    res.headers['content-length'] = Buffer.byteLength(JSON.stringify(newBody));
}

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
exports.isAdmin = function(user) {
    return this.hasRole(user, config.oauth2.roles.admin);
};

/**
 * Checks if the given `user` has a role labeled as the given `roleName`.
 * @param {Object} user
 * @param {String} roleName
 */
exports.hasRole = function(user, roleName) {
    return (
        user != null &&
        'roles' in user &&
        user.roles.some(function(role) {
            return role.name.toLowerCase() === roleName.toLowerCase();
        })
    );
};

/**
 * Checks if the provided object is empty
 * @param object
 * @returns {boolean}
 */
exports.emptyObject = function emptyObject(object) {
    if (!object) {
        return true;
    }

    return !Object.keys(object).length;
};

/**
 * Returns whether the current user is an organization
 * @param {Object} req Expess request object
 * @returns {boolean}
 */
exports.isOrganization = function isOrganization(req) {
    return !!req.user && !!req.user.userNickname;
};
