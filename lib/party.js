var request = require('request'),
    config = require('./../config.js'),
    utils = require('./utils.js');


var partyClient = (function() {

    var makePartyRequest = function(path, body, method, errMsg, callback){

	var headers = {
            'content-type': 'application/json',
            'accept': 'application/json'
        };

	var url = utils.getAPIURL(config.endpoints.party.appSsl, config.endpoints.party.host, config.endpoints.party.port, path);

	var options = {
	    url: url,
            method: method,
            headers: headers,
	    body: JSON.stringify(body)
	};

	request(options, function(err, response, body) {
	    
            if (err || response.statusCode >= 400) {
		
                var status = response ? response.statusCode : 504;
                var message = errMsg;
		
                if ([400, 403, 409, 422].indexOf(status) >= 0) {
                    var parsedResp = JSON.parse(body);
                    message = parsedResp['error'];
                }
		
                callback({
                    status: status,
                    message: message
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

    var getOrganizations = function(callback){
	makePartyRequest('/DSPartyManagement/api/partyManagement/v2/organization',
			 {},
			 'GET',
			 'The connection has failed during the request',
			 callback);
    }
    var createOrganization = function(body, callback){
	makePartyRequest('/DSPartyManagement/api/partyManagement/v2/organization',
			 body,
			 'POST',
			 'The connection has failed while creating the organization',
			 callback);
    }
    var updateOrganization = function(orgId, body, callback){
	makePartyRequest('/DSPartyManagement/api/partyManagement/v2/organization/:'+orgId,
			 body,
			 'PATCH',
			 'The connection has failed while updating the organization',
			 callback);
    }
})();
