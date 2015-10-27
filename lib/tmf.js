var config = require('./../config.js'),
    catalog = require('./../controllers/tmforum/catalog'),
    ordering = require('./../controllers/tmforum/ordering'),
    inventory = require('./../controllers/tmforum/inventory'),
    url = require('url');

var TMF  = (function() {

    var api_controlers = {};
    api_controlers[config.tmf.catalog_path] = catalog;
    api_controlers[config.tmf.ordering_path] = ordering;
    api_controlers[config.tmf.inventory_path] = inventory;

    var check_permissions = function(req, user_info, callback, callbackError) {
        var api = url.parse(req.url).path.split('/')[1];
        api_controlers[api].check_permissions(req, user_info, callback, callbackError);
    };

    return {
        check_permissions: check_permissions
    }
})();

exports.TFM = TMF;