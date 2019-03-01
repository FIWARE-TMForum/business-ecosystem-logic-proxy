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
    utils = require('./../../lib/utils'),
    indexes = require('./../../lib/indexes'),
    tmfUtils = require('./../../lib/tmfUtils');

var inventory = (function() {
    var validateRetrieving = function(req, callback) {
        // Check if requesting a list of a single product
        if (req.path.endsWith('product')) {
            tmfUtils.filterRelatedPartyFields(req, callback);
        } else {
            callback();
        }

        // For validating the retrieving of a single product it is necessary to read the product first
        // so it is done is postvalidation method
    };

    var inventoryRegex = new RegExp('/product(\\?|$)');

    var createQuery = indexes.genericCreateQuery.bind(null, ['status', 'name'], 'inventory', function(req, query) {
        if (req.query['relatedParty.id']) {
            indexes.addAndCondition(query, { relatedPartyHash: [indexes.fixUserId(req.query['relatedParty.id'])] });
        }

        utils.queryAndOrCommas(req.query['body'], 'body', query);
        utils.queryAndOrCommas(req.query['status'], 'status', query);
    });

    var getInventoryRequest = indexes.getMiddleware.bind(null, inventoryRegex, createQuery, indexes.searchInventory);

    var methodIndexed = function methodIndexed(req) {
        return getInventoryRequest(req);
    };

    var validators = {
        GET: [utils.validateLoggedIn, tmfUtils.ensureRelatedPartyIncluded, validateRetrieving],
        POST: [utils.methodNotAllowed],
        PATCH: [utils.methodNotAllowed],
        PUT: [utils.methodNotAllowed],
        DELETE: [utils.methodNotAllowed]
    };

    var checkPermissions = function(req, callback) {
        var reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        methodIndexed(req)
            .catch(() => Promise.resolve(req))
            .then(() => {
                async.series(reqValidators, callback);
            });

        // async.series(reqValidators, callback);
    };

    var executePostValidation = function(req, callback) {
        var body = JSON.parse(req.body);

        // Check if the user is allowed to retrieve the requested product
        if (!Array.isArray(body) && !tmfUtils.hasPartyRole(req, body.relatedParty, 'customer')) {
            callback({
                status: 403,
                message: 'You are not authorized to retrieve the specified product from the inventory'
            });
        } else {
            callback(null);
        }
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };
})();

exports.inventory = inventory;
