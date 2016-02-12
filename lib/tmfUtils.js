var config = require('./../config');

// Checks whether a user has a role or not within the scope of the application
exports.checkRole = function (userInfo, role) {
    var valid = false;

    // Search for provider role
    for (var i = 0; i < userInfo.roles.length && !valid; i++) {
        if (userInfo.roles[i].name.toLowerCase() === role.toLowerCase()) {
            valid = true;
        }
    }

    return valid;
};

// Checks whether the owner role is included in the info field
exports.isOwner = function (userInfo, info) {
    var status = false;
    if (exports.checkRole(userInfo, config.oauth2.roles.admin)) {
        status = true;
    } else if (info.relatedParty) {
        var parties = info.relatedParty;

        for(var i = 0; !status && i < parties.length; i++) {
            var party = parties[i];

            if (party.role.toLowerCase() == 'owner' && party.id == userInfo.id) {
                status = true;
            }
        }
    }

    return status;
};

// Checks that the user is the customer of a ordering
exports.isOrderingCustomer = function(userInfo, resourceInfo) {
    var isCust = false;
    var custIncluded = false;

    for (var i = 0; i < resourceInfo.relatedParty.length && !isCust; i++) {
        var party = resourceInfo.relatedParty[i];

        if (party.role.toLowerCase() === 'customer') {
            custIncluded = true;
            if (userInfo.id === party.id) {
                isCust = true;
            }
        }
    }
    return [custIncluded, isCust];
};


// Checks if the user is logged in
exports.validateLoggedIn = function(req, callback) {
    if (req.user) {
        callback();
    } else {
        callback({
            status: 401,
            message: 'You need to be authenticated to perform this request'
        });
    }
};

// Checks that the user is not trying to retrieve items from another user
exports.filterRelatedPartyFields = function(req, callback) {

    if (req.query['relatedParty.role'] || req.query['relatedParty.href']) {

        // This is required to control that a user can only access to those order items they are
        // involved. If this fields are allowed, the user will be able to access all the orderings
        // because filters applied to a list are independent from other filters applied to the
        // same list.
        // For example: relatedParty.id=fiware&relatedParty.role=Seller will return all the orderings
        // where there is one related party where fiware is involved or where there is a user with
        // the seller role (all).

        callback({
            status: 403,
            message: 'You are not allowed to filter items using these filters'
        });

    } else if (req.query['relatedParty.id']) {

        if(req.query['relatedParty.id'] === req.user.id) {
            // If the user has introduced his id properly, we can call the callback directly
            callback(null);
        } else {
            // If the user has introduced another id, the system must reject the request
            callback({
                status: 403,
                message: 'You are not authorized to retrieve the orderings made by the user ' +
                req.query['relatedParty.id']
            });
        }

    } else {

        // Users can only retrieve their offerings
        var separator = req.apiUrl.indexOf('?') >= 0 ? '&' : '?';
        req.apiUrl += separator + 'relatedParty.id=' + req.user.id;

        callback(null);
    }
};

// Checks that the relatedParty field is included when the fields query param is included
exports.ensureRelatedPartyIncluded = function(req, callback) {

    if (req.query['fields']) {

        var expr = /(^|,)relatedParty($|,)/;

        if (!expr.test(req.query['fields'])) {
            // If relatedParty is not included, include it manually

            req.query['fields'] += ',relatedParty';

            var apiPath = req.apiUrl.split('?')[0];
            var queryElements = [];

            for (var queryParam in req.query) {
                queryElements.push(queryParam + '=' + req.query[queryParam]);
            }

            var queryString = queryElements.join('&');

            req.apiUrl = apiPath + '?' + queryString;
        }
    }

    // If the user is not filtering fields, all the fields will be included!

    callback(null);
};

// Checks whether a user has a role in a set of related parties or not
exports.hasRole = function(relatedParties, role, user) {
    return relatedParties.some(function (party) {
        return party.role.toLowerCase() === role.toLowerCase() && party.id === user.id;
    });
};

// Updates a request and replace the body with a new one. The header 'content-length' is recalculated
exports.updateBody = function(req, newBody) {
    req.body = JSON.stringify(newBody);
    // When the body is updated, the content-length field has to be updated too
    req.headers['content-length'] = Buffer.byteLength(req.body);
};

// Raise a 405 error
exports.methodNotAllowed = function(req, callback) {
    callback({
        status: 405,
        message: 'The HTTP method ' + req.method + ' is not allowed in the accessed API'
    });
};