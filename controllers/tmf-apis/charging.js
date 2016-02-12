/**
 * Created by francisco on 24/11/15.
 */

var charging = (function() {

    var checkPermissions = function (req, callback) {
        callback();
    };

    return {
        checkPermissions: checkPermissions
    };

})();

exports.charging = charging;