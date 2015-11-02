var config = require('./../config.js'),
    catalog = require('./../controllers/tmforum/catalog.js').catalog,
    ordering = require('./../controllers/tmforum/ordering.js').ordering,
    inventory = require('./../controllers/tmforum/inventory.js').inventory,
    url = require('url');

var tmf = (function() {

    var apiControllers = {};
    apiControllers[config.endpoints.catalog.path] = catalog;
    apiControllers[config.endpoints.ordering.path] = ordering;
    apiControllers[config.endpoints.inventory.path] = inventory;

    var checkPermissions = function(req, userInfo, callback, callbackError) {
        var api = url.parse(req.url).path.split('/')[1];

        if (apiControllers[api] === undefined) {
            callbackError(404, 'Path not found')
        }

        apiControllers[api].checkPermissions(req, userInfo, callback, callbackError);
    };

    return {
        checkPermissions: checkPermissions
    };

})();

exports.tmf = tmf;
