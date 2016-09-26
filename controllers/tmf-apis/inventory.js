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

var async = require('async'),
    config = require('./../../config'),
    utils = require('./../../lib/utils'),
    indexes = require('./../../lib/indexes'),
    tmfUtils = require('./../../lib/tmfUtils');

var inventory = (function() {

    var validateRetrieving = function(req, callback) {
        // Check if requesting a list of a single product
        if(req.path.endsWith('product')) {
            tmfUtils.filterRelatedPartyFields(req, callback);
        } else {
            callback();
        }

        // For validating the retrieving of a single product it is necessary to read the product first
        // so it is done is postvalidation method
    };

    var inventoryRegex = new RegExp('/product(\\?|$)');

    var keysUsed = ["relatedParty.id", "offset", "size", "status", "name"];

    var createQuery = indexes.genericCreateQuery.bind(
        null,
        ["status", "name"],
        "inventory",
        function (req, query) {
            if (req.query["relatedParty.id"]) {
                query.AND.push({ relatedPartyHash: [indexes.fixUserId(req.query["relatedParty.id"])] });
            }
        }
    );

    var getInventoryRequest = indexes.getMiddleware.bind(null, inventoryRegex, createQuery, indexes.searchInventory, keysUsed);

    var methodIndexed = function methodIndexed(req) {
        return getInventoryRequest(req);
    };

    var validators = {
        'GET': [ utils.validateLoggedIn, tmfUtils.ensureRelatedPartyIncluded, validateRetrieving ],
        'POST': [ utils.methodNotAllowed ],
        'PATCH': [ utils.methodNotAllowed ],
        'PUT': [ utils.methodNotAllowed ],
        'DELETE': [ utils.methodNotAllowed ]
    };

    var checkPermissions = function(req, callback) {

        var reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        methodIndexed(req)
            .catch(() => Promise.resolve(req))
            .then(() => { async.series(reqValidators, callback); });

        // async.series(reqValidators, callback);

    };

    var executePostValidation = function(req, callback) {
        var body = JSON.parse(req.body);

        var orderings = [];
        var isArray = true;

        if (!Array.isArray(body)) {
            orderings = [body];
            isArray = false;
        } else {
            orderings = body;
        }

        var filteredOrders = orderings.filter(function(order) {
            return tmfUtils.hasPartyRole(req, order.relatedParty, 'customer');
        });

        if (!isArray) {

            if (filteredOrders.length === 0) {
                callback({
                    status: 403,
                    message: 'You are not authorized to retrieve the specified offering from the inventory'
                });
            } else {
                utils.updateBody(req, filteredOrders[0]);
                callback(null);
            }

        } else {
            utils.updateBody(req, filteredOrders);
            callback(null);
        }

    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };
})();

exports.inventory = inventory;
