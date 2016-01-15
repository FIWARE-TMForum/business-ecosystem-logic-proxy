var async = require('async'),
    tmfUtils = require('./../../lib/tmfUtils'),
    log = require('./../../lib/logger').logger.getLogger("Root");

var inventory = (function() {

    var validateRetrieving = function(req, callback) {
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

    return {
        checkPermissions: checkPermissions
    }
})();

exports.inventory = inventory;
