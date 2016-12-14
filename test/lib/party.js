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
    
    var partyClient = function(path) {
	return proxyquire('../../lib/party', {
	    '../config.js': config,
	    './utils.js': {
		getAPIURL: function () {return url+path}
	    }
	}).partyClient;
    };
    
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

    var orgPath = '/DSPartyManagement/api/partyManagement/v2/organization/';
    var orgId = '111555999';
    var indPath = '/DSPartyManagement/api/partyManagement/v2/individual/';
    var indId = 'eugenio';

    var orgPartyClient = partyClient(orgPath);
    var indPartyClient = partyClient(indPath);

    describe('Party API error cases', function () {
	
	it ('getOrganizations should return error fields if req fails', function (done) {
	    
	    nock(url, {
		reqheaders: headers
	    }).get(orgPath)
		.reply(500, {
		    status: 500,
		    message: 'An error occurred',
		    body: 'Internal error detected'
		});
	    
	    orgPartyClient[FUNCTION_MAPPING['getOrgs']](
		(err, res) => {
		    expect(res).toBe(undefined);
		    done();	     
		});
	    
	});

	it ('getOrganization should return error fields if req fails', function (done) {
	    orgP = orgPath + orgId;
	    var orgPartyClient = partyClient(orgP);
	    nock(url, {
		reqheaders: headers
	    }).get(orgP)
		.reply(500, {
		    status: 500,
		    message: 'An error occurred',
		    body: 'Internal error detected'
		});
	    
	    orgPartyClient[FUNCTION_MAPPING['getOrg']](orgId, 
		(err, res) => {
		    expect(res).toBe(undefined);
		    done();	     
		});
	    
	});

	it ('createOrganization should return error fields if req fails', function (done) {

	    nock(url, {
		reqheaders: headers
	    }).post(orgPath)
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
	    
	    orgPartyClient[FUNCTION_MAPPING['mkOrg']](content,
		(err, res) => {
		    expect(res).toBe(undefined);
		    done();	     
		});
	    
	});

	it ('updateOrganization should return error fields if req fails', function (done) {

	    orgP = orgPath + orgId;
	    var orgPartyClient = partyClient(orgP);
	    nock(url, {
		reqheaders: headers
	    }).patch(orgP)
		.reply(500, {
		    status: 500,
		    message: 'An error occurred',
		    body: 'Internal error detected'
		});
	    
	    var content = {
		tradingName: 'LifeOfBrian'
	    };
	    
	    orgPartyClient[FUNCTION_MAPPING['updOrg']](orgId, content, 
		(err, res) => {
		    expect(res).toBe(undefined);
		    done();	     
		});
	    
	});

	it ('getIndividual should return error fields if req fails', function (done) {

	    indP = indPath + indId;
	    var indPartyClient = partyClient(indP);
	    
	    nock(url, {
		reqheaders: headers
	    }).get(indP)
		.reply(500, {
		    status: 500,
		    message: 'An error occurred',
		    body: 'Internal error detected'
		});
	    
	    indPartyClient[FUNCTION_MAPPING['getInd']](indId, 
		(err, res) => {
		    expect(res).toBe(undefined);
		    done();	     
		});
	    
	});

	it ('updateIndividual should return error fields if req fails', function (done) {

	    indP = indPath + indId;
	    var indPartyClient = partyClient(indP);
	    
	    nock(url, {
		reqheaders: headers
	    }).patch(indP)
		.reply(500, {
		    status: 500,
		    message: 'An error occurred',
		    body: 'Internal error detected'
		});

	    var content = {
		title: 'Sir lancelot of the Holy Grial'
	    };
	    
	    indPartyClient[FUNCTION_MAPPING['updInd']](indId, content,  
		(err, res) => {
		    expect(res).toBe(undefined);
		    done();	     
		});
	    
	});

	
    });

    describe('Party API success cases', function () {

	it ('getOrganizations should return the list of all organizations', function (done) {

	    expectedValue = [{ 'id': '111555999',
			       'href': 'www.example.org/org/1'},
			     { 'id': '123456789',
			       'href': 'www.example.org/org/2'}]
	    nock(url, {
		reqheaders: headers
	    }).get(orgPath)
		.reply(200, expectedValue);
	    
	    orgPartyClient[FUNCTION_MAPPING['getOrgs']](
		(err, res) => {
		    expect(err).toBeNull();
		    expect(res.body).toBe(JSON.stringify(expectedValue));
		    done();	     
		});
	});

	it ('getOrganization should return the required organization', function (done) {

	    orgP = orgPath + orgId;
	    var orgPartyClient = partyClient(orgP);
	    
	    expectedValue = { 'id': '111555999',
			       'href': 'www.example.org/org/1'}

	    nock(url, {
		reqheaders: headers
	    }).get(orgP)
		.reply(200, expectedValue);
	    
	    orgPartyClient[FUNCTION_MAPPING['getOrgs']](
		(err, res) => {
		    expect(err).toBeNull();
		    expect(res.body).toBe(JSON.stringify(expectedValue));
		    done();	     
		});
	});

	it ('createOrganization should return the created organization', function (done) {

	    var content = {
		id: '111555999',
		tradingName: 'AmaneceQueNoEsPoco',
		href: 'http://exampleuri.com/lack/of/imagination'
	    };
	    
	    nock(url, {
		reqheaders: headers
	    }).post(orgPath)
		.reply(200, content);
	    
	    orgPartyClient[FUNCTION_MAPPING['mkOrg']](content,
		(err, res) => {
		    expect(err).toBeNull();
		    expect(res).not.toBeNull();
		    done();	     
		});
	});

	it ('updateOrganization should return the organization updated', function (done) {

	    orgP = orgPath + orgId;
	    var orgPartyClient = partyClient(orgP);
	    nock(url, {
		reqheaders: headers
	    }).patch(orgP)
		.reply(200, {
		    'id': '111555999',
		    'tradingName': 'AmaneceQueNoEsPoco'
		});
	    
	    var content = {
		tradingName: 'LifeOfBrian'
	    };
	    
	    orgPartyClient[FUNCTION_MAPPING['updOrg']](orgId, content, 
		(err, res) => {
		    expect(err).toBeNull();
		    done();	     
		});
	    
	});

	it ('getIndividual should return the required Individual', function (done) {

	    indP = indPath + indId;
	    var indPartyClient = partyClient(indP);
	    
	    nock(url, {
		reqheaders: headers
	    }).get(indP)
		.reply(200, {
		    'id': '111555999',
		    'name': 'Vercingetorix'
		});
	    
	    indPartyClient[FUNCTION_MAPPING['getInd']](indId, 
		(err, res) => {
		    expect(err).toBeNull();
		    done();	     
		});
	});

	it ('updateIndividual should return the individual updated', function (done) {

	    indP = indPath + indId;
	    var indPartyClient = partyClient(indP);

	    var content = {
		title: 'Sir lancelot of the Holy Grial'
	    };
	    
	    nock(url, {
		reqheaders: headers
	    }).patch(indP)
		.reply(200, content);
	    
	    indPartyClient[FUNCTION_MAPPING['updInd']](indId, content,  
		(err, res) => {
		    expect(err).toBeNull();
		    done();	     
		});
	});
    });
});
