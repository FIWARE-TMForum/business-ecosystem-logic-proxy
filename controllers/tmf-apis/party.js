/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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

var async = require('async'),
    config = require('./../../config'),
    url = require('url'),
    utils = require('./../../lib/utils'),
    logger = require('./../../lib/logger').logger.getLogger('TMF');

var party = (function() {
    var validateAllowed = function(req, callback) {
        callback(null);
    };

    var validateUpdate = function(req, callback) {
        var individualsPattern = new RegExp(
            '^/' + config.endpoints.party.path + '/api/partyManagement/v2/(individual|organization)(/([^/]*))?$'
        );
        var apiPath = url.parse(req.apiUrl).pathname;

        var regexResult = individualsPattern.exec(apiPath);

        if (!regexResult || !regexResult[3]) {
            callback({
                status: 404,
                message: 'The given path is invalid'
            });
        } else if (
            req.user.id !== regexResult[3] ||
            (regexResult[1] == 'individual' && utils.isOrganization(req)) ||
            (regexResult[1] == 'organization' && !utils.isOrganization(req)) ||
            (regexResult[1] == 'organization' &&
                utils.isOrganization(req) &&
                !utils.hasRole(req.user, config.oauth2.roles.orgAdmin))
        ) {
            callback({
                status: 403,
                message: 'You are not allowed to access this resource'
            });
        } else {
            callback(null);
        }
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var validators = {
        GET: [validateAllowed],
        POST: [utils.methodNotAllowed],
        PATCH: [utils.validateLoggedIn, validateUpdate],
        PUT: [utils.validateLoggedIn, validateUpdate],
        DELETE: [utils.validateLoggedIn, validateUpdate]
    };

    var checkPermissions = function(req, callback) {
        var reqValidators = [];

        if (req.method in validators) {
            for (var i in validators[req.method]) {
                reqValidators.push(validators[req.method][i].bind(this, req));
            }

            async.series(reqValidators, callback);
        } else {
            callback({
                status: 405,
                message: 'Method not allowed'
            });
        }
    };

    return {
        checkPermissions: checkPermissions
    };
})();

exports.party = party;
