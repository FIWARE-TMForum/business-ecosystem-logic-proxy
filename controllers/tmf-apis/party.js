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

const async = require('async')
const config = require('./../../config')
const url = require('url')
const utils = require('./../../lib/utils')
const logger = require('./../../lib/logger').logger.getLogger('TMF')
const tmfUtils = require('./../../lib/tmfUtils')
const partyClient = require('./../../lib/party').partyClient


const party = (function() {
    const validateAllowed = function(req, callback) {
        callback(null);
    };

    const validateUpdate = function(req, callback) {
        if (!config.editParty) {
            // Edit parties is dissabled
            return callback({
                status: 403,
                message: 'Editing party info is dissabled in this instance'
            });
        }

        if(typeof req.body != "undefined" ) {
            // remove id and href from patches, since they would be rejected by tmf
            let newBody =  JSON.parse(req.body);
            delete newBody.id
            delete newBody.href
            utils.updateBody(req, newBody)
        }
   
        const individualsPattern = new RegExp(
            '^/' + config.endpoints.party.path + '/(individual|organization)(/([^/]*))?$'
        );
        const apiPath = url.parse(req.apiUrl).pathname;

        const regexResult = individualsPattern.exec(apiPath);

        if (!regexResult || !regexResult[3]) {
            callback({
                status: 404,
                message: 'The given path is invalid'
            });
        } else if (
            req.user.partyId !== regexResult[3] ||
            (regexResult[1] == 'individual' && utils.isOrganization(req)) ||
            (regexResult[1] == 'organization' && !utils.isOrganization(req)) ||
            (regexResult[1] == 'organization' &&
                utils.isOrganization(req) &&
                !utils.hasRole(req.user, config.roles.orgAdmin))
        ) {
            callback({
                status: 403,
                message: 'You are not allowed to access this resource'
            });
        } 
        else if (req.method === 'PATCH' && req.body && regexResult[1] === 'organization') {
            const body = JSON.parse(req.body)
            const contactMediums = body.contactMedium;
            const partyCharacteristics = body.partyCharacteristic
            if (contactMediums){
                if(!Array.isArray(contactMediums)) {
                    return callback({
                        status: 400,
                        message: 'Invalid contactMedium format'
                    });
                }

                for(const medium of contactMediums){
                    if (medium.mediumType === 'TelephoneNumber' && !tmfUtils.isValidPhoneNumber(medium.characteristic.phoneNumber)) {
                        return callback({
                            status: 422,
                            message: 'Invalid phone number'
                        });
                    }
                }
            }

            if (partyCharacteristics) {

                for (const partyChar of partyCharacteristics){
                    if (partyChar.name === "country" && partyChar.value.length !== 2){
                        return callback({
                            status: 422,
                            message: 'Invalid country code'
                        });
                    }
                }

            }

            callback(null);
        }
        else {
            callback(null);
        }
    };

    const clearPartyCache = function(req, callback) {
        let url = req.apiUrl
        let partyId = ''

        if (url.includes("?")) {
            url = url.split("?")[0]
        }

        const parts = url.split("/")
        partyId = parts[parts.length -1]

        partyClient.clearPartyCache(partyId);
        return callback(null);
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// COMMON ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    const validators = {
        GET: [validateAllowed],
        POST: [utils.methodNotAllowed],
        PATCH: [utils.validateLoggedIn, validateUpdate, clearPartyCache],
        DELETE: [utils.validateLoggedIn, validateUpdate, clearPartyCache]
    };

    const checkPermissions = function(req, callback) {
        const reqValidators = [];

        if (req.method in validators) {
            for (var i in validators[req.method]) {
                reqValidators.push(validators[req.method][i].bind(this, req));
            }

            async.series(reqValidators, callback);
        } else {
            callback({
                status: 405,
                message: 'Method not allowed'
            });
        }
    };

    return {
        checkPermissions: checkPermissions
    };
})();

exports.party = party;
