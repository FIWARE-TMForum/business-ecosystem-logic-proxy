var async = require('async'),
    tmfUtils = require('./../../lib/tmfUtils'),
    log = require('./../../lib/logger').logger.getLogger("Root");

var inventory = (function() {

    var validateRetrieving = function(req, callback) {
        // Check if requesting a list of a single product
        if(req.path.endsWith('product')) {
            if (!req.query['relatedParty.id']) {
                callback({
                    'status': 400,
                    'message': 'Missing required param relatedParty.id'
                });
                return;
            }

            if (!req.query['relatedParty.role']) {
                callback({
                    'status': 400,
                    'message': 'Missing required param relatedParty.role'
                });
                return;
            }

            if (req.query['relatedParty.id'] !== req.user.id || req.query['relatedParty.role'] !== 'Customer') {
                callback({
                    'status': 403,
                    'message': 'Your are not authorized to retrieve the specified products'
                });
                return;
            }
        }
        // For validating the retrieving of a single product it is necessary to read the product first
        // so it is done is postvalidation method
        callback();
    };

    var validators = {
        'GET': [ tmfUtils.validateLoggedIn, validateRetrieving ],
        'POST': [ tmfUtils.methodNotAllowed ],
        'PATCH': [ tmfUtils.methodNotAllowed ],
        'PUT': [ tmfUtils.methodNotAllowed ],
        'DELETE': [ tmfUtils.methodNotAllowed ]
    };

    var checkPermissions = function(req, callback) {
        log.info('Checking inventory permissions');

        var reqValidators = [];

        for (var i in validators[req.method]) {
            reqValidators.push(validators[req.method][i].bind(this, req));
        }

        async.series(reqValidators, callback);

    };

    var executePostValidation = function(req, callback) {
        log.info("Executing inventory post validation");

        if (req.method == 'GET' && !req.path.endsWith('product') &&
            (!tmfUtils.isOrderingCustomer(req.user, JSON.parse(req.body))[0]
            || !tmfUtils.isOrderingCustomer(req.user, JSON.parse(req.body))[1])) {
            callback({
                'status': 403,
                'message': 'Your are not authorized to retrieve the specified product'
            })
        } else {
            callback(null, {
                extraHdrs: {}
            });
        }
    };

    return {
        checkPermissions: checkPermissions,
        executePostValidation: executePostValidation
    }
})();

exports.inventory = inventory;
