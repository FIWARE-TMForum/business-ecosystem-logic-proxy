var async = require('async'),
    config = require('./../../config'),
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

    var validators = {
        'GET': [ tmfUtils.validateLoggedIn, tmfUtils.ensureRelatedPartyIncluded, validateRetrieving ],
        'POST': [ tmfUtils.methodNotAllowed ],
        'PATCH': [ tmfUtils.methodNotAllowed ],
        'PUT': [ tmfUtils.methodNotAllowed ],
        'DELETE': [ tmfUtils.methodNotAllowed ]
    };

    var checkPermissions = function(req, callback) {

        var reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        async.series(reqValidators, callback);

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
            return tmfUtils.hasRole(order.relatedParty, 'customer', req.user);
        });

        if (!isArray) {

            if (filteredOrders.length === 0) {
                callback({
                    status: 403,
                    message: 'You are not authorized to retrieve the specified offering from the inventory'
                });
            } else {
                tmfUtils.updateBody(req, filteredOrders[0]);
                callback(null);
            }

        } else {
            tmfUtils.updateBody(req, filteredOrders);
            callback(null);
        }

    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    };
})();

exports.inventory = inventory;
