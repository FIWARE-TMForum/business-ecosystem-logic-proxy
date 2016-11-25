/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
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

var request = require('request'),
    config = require('./../config.js'),
    utils = require('./utils.js');


// var partyClient = (function() {

var makePartyRequest = function(path, body, method, errMsg, callback){
    var headers = {
        'content-type': 'application/json',
        'accept': 'application/json'
    };
    
    var url = utils.getAPIURL(config.endpoints.party.appSsl, config.endpoints.party.host, config.endpoints.party.port, path);

    var options = {
	url: url,
        method: method,
        headers: headers
    };
    if (body) {
	options.body = JSON.stringify(body)
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

exports.getOrganizations = function(callback){
    makePartyRequest('/DSPartyManagement/api/partyManagement/v2/organization',
		     null,
		     'GET',
		     'The connection has failed during the request',
		     callback);
};

exports.createOrganization = function(body, callback){
    makePartyRequest('/DSPartyManagement/api/partyManagement/v2/organization',
		     body,
		     'POST',
		     'The connection has failed while creating the organization',
		     callback);
};

exports.updateOrganization = function(orgId, body, callback){
    makePartyRequest('/DSPartyManagement/api/partyManagement/v2/organization/'+orgId,
		     body,
		     'PATCH',
		     'The connection has failed while updating the organization',
		     callback);
};

exports.getIndividual = function(indID, callback){
    makePartyRequest('/DSPartyManagement/api/partyManagement/v2/individual/'+indID,
		     null,
		     'GET',
		     'The connection has failed getting user info',
		     callback
    )
};
exports.updateIndividual = function(indID, body, callback){
    makePartyRequest('/DSPartyManagement/api/partyManagement/v2/individual/'+indID,
		     body,
		     'PATCH',
		     'The connection has failed while updating the individual',
		     callback
		    )
};
