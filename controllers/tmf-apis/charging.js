/**
 * Created by francisco on 24/11/15.
 */

var charging = (function() {

    var checkPermissions = function (req, callback) {
        if (req.apiUrl.indexOf('api/orderManagement/orders/refund') >= 0) {
            callback({
                status: 403,
                message: 'This API is private'
            })
        } else {
            callback(null);
        }
    };

    return {
        checkPermissions: checkPermissions
    };

})();

exports.charging = charging;