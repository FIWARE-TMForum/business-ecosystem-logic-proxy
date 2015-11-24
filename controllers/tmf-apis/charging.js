/**
 * Created by francisco on 24/11/15.
 */
var log = require('./../../lib/logger').logger.getLogger("Root");

var charging = (function() {

    var checkPermissions = function (req, callback, callbackError) {
        log.info('Redirecting to charging backend APIs');
        callback();
    };

    return {
        checkPermissions: checkPermissions
    };

})();

exports.charging = charging;