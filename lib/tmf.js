var config = require('./../config.js'),
    catalog = require('./../controllers/tmforum/catalog'),
    ordering = require('./../controllers/tmforum/ordering'),
    inventory = require('./../controllers/tmforum/inventory'),
    url = require('url');

var tmf = (function() {

    var apiControllers = {};
    apiControllers[config.tmf.catalogPath] = catalog;
    apiControllers[config.tmf.orderingPath] = ordering;
    apiControllers[config.tmf.inventoryPath] = inventory;

    var checkPermissions = function(req, userInfo, callback, callbackError) {
        var api = url.parse(req.url).path.split('/')[1];

        if (apiControllers[api] === undefined) {
            callbackError(404, 'Path not found')
        }

        apiControllers[api].checkPermissions(req, userInfo, callback, callbackError);
    };

    return {
        checkPermissions: checkPermissions
    }

})();

exports.tmf = tmf;
