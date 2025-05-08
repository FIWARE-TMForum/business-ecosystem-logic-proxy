/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
 *
 * This file belongs to the business-ecosystem-logic-proxy of the
 * Business API Ecosystem
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const config = require('./../config');
const equal = require('deep-equal');
const normalize = require('normalize-url');
const utils = require('./utils');
const {parsePhoneNumber } = require('libphonenumber-js/max')

/**
 * Checks if the `user` of a `req` is owner of the given `resource`.
 * @param {Object} req
 * @param {Object} resource
 */
exports.isOwner = function(req, resource) {
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
            if (userInfo.partyId === party.id) {
                isCust = true;
            }
        }
    }
    return [custIncluded, isCust];
};

var filterRelatedParty = function(req, callback) {
    if (req.query['relatedParty.href']) {
        // This is required to control that a user can only access to those order items they are
        // involved. If these fields are allowed, the user will be able to access all the orderings
        // because filters applied to a list are independent from other filters applied to the
        // same list.
        // For example: relatedParty.id=fiware&relatedParty.role=Seller will return all the orderings
        // where there is one related party where fiware is involved OR where there is a user with
        // the seller role (all).

        callback({
            status: 403,
            message: 'You are not allowed to filter items using these filters'
        });
    } else if (req.query['relatedParty.id']) {
        if (req.query['relatedParty.id'] === req.user.partyId) {
            // If the user has introduced his id properly, we can call the callback directly
            callback(null);
        } else {
            // If the user has introduced another id, the system must reject the request
            callback({
                status: 403,
                message:
                'You are not authorized to retrieve the entities made by the user ' + req.query['relatedParty.id']
            });
        }
    } else {
        // Users can only retrieve their offerings
        var separator = req.apiUrl.indexOf('?') >= 0 ? '&' : '?';
        req.apiUrl += separator + 'relatedParty.id=' + req.user.partyId;
        callback(null);
    }
};

/**
 * Checks that the user is not trying to retrieve items from another user, allowing to filter by relatedParty.role
 * @param {Object} req
 * @param {Function} callback Is called when error when the user is trying to access to
 * resources they do not own. Otherwise, is called with null.
 */
exports.filterRelatedPartyWithRole = function(req, allowedRoles, callback) {
    if (req.query['relatedParty.role'] && allowedRoles.indexOf(req.query['relatedParty.role'].toLowerCase()) < 0) {
        callback({
            status: 403,
            message: 'You are not allowed to filter parties using the specified role'
        });
    } else {
        filterRelatedParty(req, callback);
    }
};

exports.validateNameField = function(name, modelName) {
    // Check that the resourceName name is a String
    if (typeof name !== 'string') {
        return `${modelName} name must be a string`
    }
    // Check that the resourceName name is 100 characters or less
    if (name.length > 100) {
        return `${modelName} name is too long, it must be less than 100 characters`
    }
    // Check that the resourceName name is not empty or only with spaces
    if (name.trim() === '') {
        return `${modelName} name is empty`
    }
    return null
}

exports.validateDescriptionField = function(description, modelName) {
    // Check that the modelName description is 100.000 characters or less
    if (description.length > 100000) {
        return `${modelName} description is too long, it must be less than 100.000 characters`
    }
    return null
}

/**
 * Checks that the user is not trying to retrieve items from another user
 * @param {Object} req
 * @param {Function} callback Is called when error when the user is trying to access to
 * resources they do not own. Otherwise, is called with null.
 */
exports.filterRelatedPartyFields = function(req, callback) {
    if (req.query['relatedParty.role']) {
        callback({
            status: 403,
            message: 'You are not allowed to filter items using these filters'
        });
    } else {
        filterRelatedParty(req, callback);
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
exports.hasPartyRole = function(req, partyList, roleName) {
    const user = req.user ? req.user.partyId : undefined;
    return (
        req.user != null &&
        partyList.some(function(party) {
            return (
                party.id === user &&
                (roleName ? party.role.toLowerCase() === roleName.toLowerCase() : true)
            );
        })
    );
};

/**
 * Checks if the user is included the list of related parties. This is just a wrapper of
 * `hasPartyRole(req, partyList, null)`.
 * @param {Object} req
 * @param {Array.<Object>} partyList
 * @return {boolean} true if the user is included in the `partyList`. False otherwise.
 */
exports.isRelatedParty = function(req, partyList) {
    return this.hasPartyRole(req, partyList, null);
};

/**
 * Returns the URL that external users will use to access an individual or the list of individuals
 * provided by the party API. The hostname, and the protocol will be derived from the request made
 * by the user. If user is not null, the URL to access that user will be provided. Otherwise, the
 * function will return the URL to retrieve the list of users.
 * @param {Object} req The request made by the user.
 * @param {String} user The user whose URL want to be retrieved. If null, the URL to the collection
 * is returned
 * @return {String} The URL that external users can use to access an individual or the list of
 * individuals
 */
exports.getIndividualURL = function(req, user) {
    var hostname, secured, port;
    var path = (req.user && req.user.userNickname && req.user.userNickname !== req.user.partyId) ? 'organization/' : 'individual/';
    // Check if specific URLs for HREFs have been configured

    if (config.proxy.enabled) {
        hostname = config.proxy.host;
        secured = config.proxy.secured;
        port = config.proxy.port;
    } else {
        hostname = req.hostname;
        secured = req.secure;
        port = config.port;
    }

    return utils.getAPIURL(
        secured,
        hostname,
        port,
        '/' + config.endpoints.party.path + '/' + path + (user || '')
    );
};

/**
 * Returns whether a product specification refers to a digital product using its set of characteristics
 * @param characteristics Set of characteristics of the product specification to check
 * @returns {boolean} True if the product is digital
 */
exports.isDigitalProduct = function(characteristics) {
    var hasMedia = false;
    var hasLocation = false;
    var hasAssetType = false;

    // Check if the product is digital
    if (characteristics) {
        for (var i = 0; i < characteristics.length && (!hasMedia || !hasLocation || !hasAssetType); i++) {
            var charact = characteristics[i];
            if (charact.name.toLowerCase() === 'asset type') {
                hasAssetType = true;
            }

            if (charact.name.toLowerCase() === 'media type') {
                hasMedia = true;
            }

            if (charact.name.toLowerCase() === 'location') {
                hasLocation = true;
            }
        }
    }

    return hasAssetType && hasLocation && hasMedia;
};

/**
 * Checks whether the custom characteristics of two products are equal
 * @param chars1 Characteristics of the first product
 * @param chars2 Characteristics of the second product
 */
exports.equalCustomCharacteristics = function(chars1, chars2) {
    var digitalCharFilter = (char) => {
        return !['asset type', 'media type', 'location'].some((digChar) => {
            return digChar === char.name.toLowerCase();
        });
    };

    // Filter digital asset characteristics
    var filteredChars1 = chars1.filter(digitalCharFilter);
    var filteredChars2 = chars2.filter(digitalCharFilter);

    // Compare resulting characteristics
    return equal(filteredChars1, filteredChars2);
};


exports.isValidStatusTransition = function(firstSt, nextSt) {
    const lifecycle = ['active', 'launched', 'retired', 'obsolete']

    const firstInd = lifecycle.indexOf(firstSt.toLowerCase())
    const nextInd = lifecycle.indexOf(nextSt.toLowerCase())

    return firstInd > -1 && nextInd > -1 && (nextInd == firstInd + 1 || nextInd == firstInd)
}

/**
 * Checks whether the specified status are the same in each element of the array
 * @param status Value of lifecycleStatus in lower case that should be in each element of the array
 * @param array An array of service/resource specification references
 */
exports.haveSameStatus = function(status, array){
    size= array.reduce((acc, spec) => {
        if(!!spec.lifecycleStatus && spec.lifecycleStatus.toLowerCase() === status){
           acc++
        }
        return acc
    }, 0)
    return (size === array.length)
}

/**
 * Extracts id of each reference and returns a String with all ids in query param mode
 * @param refs An array of dependency references
 */
exports.refsToQuery = function(refs){
    if (!refs || refs.length === 0) {
        return ''
    }
    return refs.map(ref => ref.id).join(',');
}

exports.hasValidPhoneNumber = function(contacts){
    if (!contacts)
        return true
    for (let contact of contacts){
        const phoneNumber = contact.contactMedium.filter((medium) => {
            return medium.mediumType === 'TelephoneNumber'
        })[0].characteristic.phoneNumber
        try{
            if(phoneNumber){
                const checkNumber = new parsePhoneNumber(phoneNumber)
                if(!checkNumber.isValid()){
                    return false
                }
            }
        }
        catch(error){
            return false
        }
    }
    return true
}
