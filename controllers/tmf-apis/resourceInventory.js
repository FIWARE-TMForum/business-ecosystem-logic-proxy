/* Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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

const async = require('async')
const utils = require('./../../lib/utils')
const tmfUtils = require('./../../lib/tmfUtils')

const resourceInventory = (function() {
    const validateRetrieving = function(req, callback) {
        // Check if requesting a list of a single resource
        if (req.path.endsWith('resource')) {
            tmfUtils.filterRelatedPartyFields(req, callback);
        } else {
            callback();
        }

        // For validating the retrieving of a single resource it is necessary to read the resource first
        // so it is done in postvalidation method
    };

    const validators = {
        GET: [utils.validateLoggedIn, tmfUtils.ensureRelatedPartyIncluded, validateRetrieving],
        POST: [utils.methodNotAllowed],
        PATCH: [utils.methodNotAllowed],
        PUT: [utils.methodNotAllowed],
        DELETE: [utils.methodNotAllowed]
    };

    const checkPermissions = function(req, callback) {
        const reqValidators = [];

        for (let i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        async.series(reqValidators, callback);
    };

    const executePostValidation = function(req, callback) {
        const body = req.body;

        // Check if the user is allowed to retrieve the requested resource
        if (!Array.isArray(body) && !tmfUtils.hasPartyRole(req, body.relatedParty, 'customer')) {
            callback({
                status: 403,
                message: 'You are not authorized to retrieve the specified resource from the inventory'
            });
        } else if (Array.isArray(body)) {
            // TODO: This filter should be done by API itself
            const newBody = body.filter((resource) => {
                return tmfUtils.hasPartyRole(req, resource.relatedParty, 'customer')
            })
            utils.updateResponseBody(req, newBody)
            callback(null)
        } else {
            callback(null);
        }
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };
})();

exports.resourceInventory = resourceInventory;
