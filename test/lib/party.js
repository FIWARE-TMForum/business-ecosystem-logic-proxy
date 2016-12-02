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
var nock = require ('nock'),
    proxyquire = require('proxyquire'),
    testUtils = require('../utils');


describe('Party lib', function () {

    var config = testUtils.getDefaultConfig();

    var url = 'http://' + config.endpoints.party.host + ':' + config.endpoints.party.port;
    
    var partyClient = proxyquire('../../lib/party', {
	'../config.js': config,
	'./utils.js': {
	    getAPIURL: function () {return url}
	}
    }).partyClient;

    var headers = {
        'content-type': 'application/json',
        'accept': 'application/json'
    };

    var FUNCTION_MAPPING = {};
    FUNCTION_MAPPING['getOrg'] = 'getOrganization';
    FUNCTION_MAPPING['getOrgs'] = 'getOrganizations';
    FUNCTION_MAPPING['mkOrg'] = 'createOrganization';
    FUNCTION_MAPPING['updOrg'] = 'updateOrganization';
    FUNCTION_MAPPING['getInd'] = 'getIndividual';
    FUNCTION_MAPPING['updInd'] = 'updateIndividual';

    describe('Party API', function () {
	
	it ('getOrganizations should return error fields if req fails', function (done) {

	    var path = '/DSPartyManagement/api/partyManagement/v2/organization/';
	    
	    nock(url, {
		reqheaders: headers
	    }).get(path)
		.reply(500, {
		    status: 500,
		    message: 'An error occurred',
		    body: 'Internal error detected'
		});
	    
	    partyClient[FUNCTION_MAPPING['getOrgs']](
		(err, res) => {
		    expect(res).toBe(undefined);
		    done();	     
		});
	    
	});

	it ('getOrganization should return error fields if req fails', function (done) {
	    var orgId = '111555999'
	    var path = '/DSPartyManagement/api/partyManagement/v2/organization/' + orgId;

	    nock(url, {
		reqheaders: headers
	    }).get(path)
		.reply(500, {
		    status: 500,
		    message: 'An error occurred',
		    body: 'Internal error detected'
		});
	    
	    partyClient[FUNCTION_MAPPING['getOrg']](orgId, 
		(err, res) => {
		    expect(res).toBe(undefined);
		    done();	     
		});
	    
	});

	it ('createOrganization should return error fields if req fails', function (done) {

	    var path = '/DSPartyManagement/api/partyManagement/v2/organization/';

	    nock(url, {
		reqheaders: headers
	    }).post(path)
		.reply(500, {
		    status: 500,
		    message: 'An error occurred',
		    body: 'Internal error detected'
		});
	    
	    var content = {
		id: '111555999',
		tradingName: 'AmaneceQueNoEsPoco',
		href: 'http://exampleuri.com/lack/of/imagination'
	    };
	    
	    partyClient[FUNCTION_MAPPING['mkOrg']](content,
		(err, res) => {
		    expect(res).toBe(undefined);
		    done();	     
		});
	    
	});

	it ('updateOrganization should return error fields if req fails', function (done) {

	    var orgId = '111555999'
	    var path = '/DSPartyManagement/api/partyManagement/v2/organization/';

	    nock(url, {
		reqheaders: headers
	    }).patch(path)
		.reply(500, {
		    status: 500,
		    message: 'An error occurred',
		    body: 'Internal error detected'
		});
	    
	    var content = {
		tradingName: 'LifeOfBrian'
	    };
	    
	    partyClient[FUNCTION_MAPPING['updOrg']](orgId, content, 
		(err, res) => {
		    expect(res).toBe(undefined);
		    done();	     
		});
	    
	});

	it ('getIndividual should return error fields if req fails', function (done) {

	    var indId = 'eugenio'
	    var path = '/DSPartyManagement/api/partyManagement/v2/individual/' + indId;

	    nock(url, {
		reqheaders: headers
	    }).get(path)
		.reply(500, {
		    status: 500,
		    message: 'An error occurred',
		    body: 'Internal error detected'
		});
	    
	    partyClient[FUNCTION_MAPPING['getInd']](indId, 
		(err, res) => {
		    expect(res).toBe(undefined);
		    done();	     
		});
	    
	});

	it ('updateIndividual should return error fields if req fails', function (done) {

	    var indId = 'eugenio'
	    var path = '/DSPartyManagement/api/partyManagement/v2/organization/' + indId;

	    nock(url, {
		reqheaders: headers
	    }).patch(path)
		.reply(500, {
		    status: 500,
		    message: 'An error occurred',
		    body: 'Internal error detected'
		});

	    var content = {
		title: 'Sir lancelot of the Holy Grial'
	    };
	    
	    partyClient[FUNCTION_MAPPING['updInd']](indId, content,  
		(err, res) => {
		    expect(res).toBe(undefined);
		    done();	     
		});
	    
	});

	
    });
});
