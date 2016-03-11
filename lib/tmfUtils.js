var config = require('./../config');


/**
 * Checks if the given `user` is owner of the given `resource`.
 * @param {Object} user
 * @param {Object} resource
 */
exports.isOwner = function (user, resource) {
    return 'relatedParty' in resource && this.hasPartyRole(user, resource.relatedParty, 'owner');
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

/**
 * Checks if the given `user` has the given `role` in the given `partyList`.
 * @param {Object} user
 * @param {Array.<Object>} partyList
 * @param {Strong} roleName
 */
exports.hasPartyRole = function (user, partyList, roleName) {
    return user != null && partyList.some(function (party) {
        return party.id === user.id && party.role.toLowerCase() === roleName.toLowerCase();
    });
};
