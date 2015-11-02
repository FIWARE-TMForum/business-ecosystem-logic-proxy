var config = require('./../../config.js'),
    url = require('url');

exports.attachUserHeaders = function(headers, userInfo) {
    headers['X-Nick-Name'] = userInfo.id;
    headers['X-Display-Name'] = userInfo.displayName;
    headers['X-Roles'] = userInfo.roles;
    headers['X-Organizations'] = userInfo.organizations;
};

exports.getAppPort = function(req) {
    var api = url.parse(req.url).path.split('/')[1];

    // Check accessed system
    var ports = {};
    ports[config.endpoints.catalog.path] = config.endpoints.catalog.port;
    ports[config.endpoints.ordering.path] = config.endpoints.ordering.port;
    ports[config.endpoints.inventory.path] = config.endpoints.inventory.port;
    ports[config.endpoints.charging.path] = config.endpoints.charging.port;
    ports[config.endpoints.rss.path] = config.endpoints.rss.port;

    // Return related port
    return ports[api];
};