var config = require('./../config'),
    utils = require('./utils');


/**
 * Checks if the `user` of a `req` is owner of the given `resource`.
 * @param {Object} req
 * @param {Object} resource
 */
exports.isOwner = function (req, resource) {
    return 'relatedParty' in resource && this.hasPartyRole(req, resource.relatedParty, 'owner');
};

/**
 * Checks that the user is the customer of an ordering
 * @param {Object} userInfo The information of the user
 * @param {Object} resourceInfo The ordering
 * @returns {Array.<Boolean>} An array with two booleans. The first one indicates if the customer role
 * is included while the second one indicates if that customer role matches with the user information
 * provided.
 */
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

/**
 * Checks that the user is not trying to retrieve items from another user
 * @param {Object} req
 * @param {Function} callback Is called when error when the user is trying to access to
 * resources they do not own. Otherwise, is called with null.
 */
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

/**
 * When filtering the fields to be retrieved, this function ensures that the `relatedParty` field
 * will always be returned so that controllers can check permissions. You can specify a callback
 * just in case the function is called asynchronously.
 * @param {Object} req
 * @param {Function} callback In case the function is called asynchronously.
 */
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
    if (callback) {
        callback(null);
    }
};

/**
 * Checks if the `user` of a `req` has the given `role` in the given `partyList`. If
 * `role` is null, the method will check that the user is included in the `partyList`.
 * @param {Object} req Object with the request. It must include an object with the
 * `user`, a `secure` boolean that specifies whether the request is secure and a string
 * with the `hostname`. `secure` and `hostname` are required to check the `href` field
 * of the involved parties.
 * @param {Array.<Object>} partyList
 * @param {String} roleName The role to be checked. If null, the method will check that
 * the user is included in the `partyList`.
 * @return {boolean}
 *  * If role included: true if the user is included in the `partyList` with the
 *  specified `role`. False otherwise.
 *  * If role not included: true if the user is included in the `partyList`.
 *  False otherwise.
 */
exports.hasPartyRole = function (req, partyList, roleName) {

    var self = this;

    return req.user != null && partyList.some(function (party) {

        var expectedHref = self.getIndividualURL(req, req.user.id);

        return party.id === req.user.id && party.href === expectedHref &&
            (roleName ? party.role.toLowerCase() === roleName.toLowerCase() : true);
    });
};

/**
 * Checks if the user is included the list of related parties. This is just a wrapper of
 * `hasPartyRole(req, partyList, null)`.
 * @param {Object} req
 * @param {Array.<Object>} partyList
 * @return {boolean} true if the user is included in the `partyList`. False otherwise.
 */
exports.isRelatedParty = function(req, partyList) {
    this.hasPartyRole(req, partyList, null);
};

/**
 * Returns the URL that external users will use to access an individual or the list of individuals
 * provided by the party API. The hostname, and the protocol will be derived from the request made
 * by the user. If user is not null, the URL to access that user will be provided. Otherwise, the
 * function will return the URL to retrieve the list of users.
 * @param {Object} req The request made by the user.
 * @param {String=} user The user whose URL want to be retrieved. If null, the URL to the collection
 * is returned
 * @return {String} The URL that external users can use to access an individual or the list of
 * individuals
 */
exports.getIndividualURL = function(req, user) {

    return utils.getAPIURL(req.secure, req.hostname, config.port, '/' + config.endpoints.party.path +
        '/api/partyManagement/v2/individual/' + (user ? user : ''));
};
