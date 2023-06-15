/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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

var request = require('request');

var config = require('../config.js');

var utils = require('./utils.js');

var partyClient = (function() {
    var makePartyRequest = function(path, body, method, errMsg, callback) {
        var headers = {
            'content-type': 'application/json',
            accept: 'application/json'
        };

        var url = utils.getAPIURL(
            config.endpoints.party.appSsl,
            config.endpoints.party.host,
            config.endpoints.party.port,
            path
        );

        var options = {
            url: url,
            method: method,
            headers: headers
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        request(options, function(err, response, body) {
            if (err || response.statusCode >= 400) {
                var status = response ? response.statusCode : 504;
                var message = errMsg;

                if ([400, 403, 409, 422].indexOf(status) >= 0 && body) {
                    var parsedResp = JSON.parse(body);
                    message = parsedResp['error'];
                }
                callback({
                    status: status,
                    message: message,
                    body: body
                });
            } else {
                callback(null, {
                    status: response.statusCode,
                    headers: response.headers,
                    body: body
                });
            }
        });
    };

    var getOrganizations = function(callback) {
        makePartyRequest(
            '/organization/',
            null,
            'GET',
            'The connection has failed while requesting all the organizations of the party API',
            callback
        );
    };

    var getOrganization = function(orgId, callback) {
        makePartyRequest(
            '/organization/' + orgId,
            null,
            'GET',
            'The connection has failed while requesting organization with id: ' + orgId,
            callback
        );
    };

    var createOrganization = function(body, callback) {
        makePartyRequest(
            '/organization',
            body,
            'POST',
            'The connection has failed while creating the organization',
            callback
        );
    };

    var updateOrganization = function(orgId, body, callback) {
        makePartyRequest(
            '/organization/' + orgId,
            body,
            'PATCH',
            'The connection has failed while updating the organization',
            callback
        );
    };

    var getIndividual = function(indID, callback) {
        makePartyRequest(
            '/individual/' + indID,
            null,
            'GET',
            'The connection has failed getting user info',
            callback
        );
    };

    var getIndividuals = function(callback) {
        makePartyRequest(
            '/individual/',
            null,
            'GET',
            'The connection has failed getting all users info',
            callback
        );
    };

    var updateIndividual = function(indID, body, callback) {
        makePartyRequest(
            '/individual/' + indID,
            body,
            'PATCH',
            'The connection has failed while updating the individual',
            callback
        );
    };

    var createIndividual = function(body, callback) {
        makePartyRequest(
            '/individual/',
            body,
            'POST',
            'The connection has failed while creating the individual',
            callback
        );
    };

    var convertID = function(new_format, old_format) {
        for (var user of new_format) {
            for (ref of user.externalReference) {
                if (ref.externalReferenceType === 'idm_id') {
                    if (ref.name === old_format.id) {
                        return user.id;
                    }

                }
            }
        }
    };

    return {
        getOrganization: getOrganization,
        getOrganizations: getOrganizations,
        createOrganization: createOrganization,
        updateOrganization: updateOrganization,
        getIndividual: getIndividual,
        getIndividuals: getIndividuals,
        updateIndividual: updateIndividual,
        createIndividual: createIndividual,
        convertID: convertID
    };
})();

exports.partyClient = partyClient;
