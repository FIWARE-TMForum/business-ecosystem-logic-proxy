var log = require('./../../lib/logger').logger.getLogger("Root");

var onboarding = (function() {

    var checkPermissions = function (req, callback) {
        log.info('Checking on Boarding permissions');
        callback();
    };

    return {
        checkPermissions: checkPermissions
    };

})();

exports.onboarding = onboarding;
