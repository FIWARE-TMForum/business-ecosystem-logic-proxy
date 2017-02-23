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

var proxyquire =  require('proxyquire'),
    testUtils = require('../utils');


describe('Utils', function() {

    var config = testUtils.getDefaultConfig();
    var utils = proxyquire('../../lib/utils', { './../config.js': config });

    describe('Attach User Headers', function() {

        it('should include Nick Name, Display Name and X Actor', function() {
            
            var headers = {};
            var userInfo = {
                id: 'user-1',
                displayName: 'User 1',
                roles: [{
                    'id': '106',
                    'name': 'Provider'
                }, {
                    'id': '77',
                    'name': 'seller'
                }, {
                    'id': '100',
                    'name': 'Purchaser'
                }]
            };

            // This function should modify headers
            utils.attachUserHeaders(headers, userInfo);

            // Check that heacers has been modified appropriately
            expect(headers['X-Nick-Name']).toBe(userInfo.id);
            expect(headers['X-Display-Name']).toBe(userInfo.displayName);
            expect(headers['X-Roles']).toBe('provider,seller,');
	    expect(headers['X-Actor']).toBe(userInfo.id)
        });
    });

    describe('Check Roles', function() {

        it ('should return true when checking the given role', function() {
            var userInfo = {
                roles: [{
                    name: 'norole'
                }, {
                    name: 'role'
                }]
            };

            expect(utils.hasRole(userInfo, 'role')).toBeTruthy();
        });

        it ('should return false when checking the given role', function() {
            var userInfo = {
                roles: [{
                    name: 'norole'
                }]
            };

            expect(utils.hasRole(userInfo, 'role')).toBeFalsy();
        });

    });

    describe('Validated Logged In', function() {

        it ('should call the callback with OK when the user is logged', function(done) {
            var req = {
                user: 'test'
            };

            utils.validateLoggedIn(req, function(err) {
                expect(err).toBe(undefined);
                done();
            });
        });

        it ('should call the callback with error 401 if the user is not logged', function(done) {
            var req = {};

            utils.validateLoggedIn(req, function(err) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(401);
                expect(err.message).toBe('You need to be authenticated to perform this request');
                done();
            });
        });

    });

    describe('Update Body', function() {

        it('should update the body with a stringified version of the object given', function() {

            var newBody = { example: '1', id: 7, user: { name: 'fiware' } };

            var req = {
                body: null,
                headers: {}
            };

            utils.updateBody(req, newBody);

            var stringifiedBody = JSON.stringify(newBody);
            var expectedLength = stringifiedBody.length;

            expect(req.body).toBe(stringifiedBody);
            expect(req.headers['content-length']).toBe(expectedLength);

        });

    });

    describe('Method Not Allowed', function() {
        it('should call the callback with a 405 error message', function(done) {
            var req = {
                method: 'DELETE'
            };

            utils.methodNotAllowed(req, function(err) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(405);
                expect(err.message).toBe('The HTTP method DELETE is not allowed in the accessed API');
                done();
            });
        });
    });

    describe('Proxied Request Headers', function() {

        var testProxiedRequestHeaders = function(previousForwardedFor, remoteAddress, expectedForwardedFor) {

            var forwardForHeaderName = 'x-forwarded-for';

            var headers = {
                accept: 'application/json',
                customHeader: 'customValue'
            };

            if (previousForwardedFor) {
                headers[forwardForHeaderName] = previousForwardedFor;
            }

            var req = {
                headers: headers,
                connection: {
                    remoteAddress: remoteAddress
                }
            };

            var finalHeaders = utils.proxiedRequestHeaders(req);

            // Check that x-forwarded-for has been set
            expect(finalHeaders[forwardForHeaderName]).toBe(expectedForwardedFor);


            // Check the rest of the headers
            for (var header in headers) {
                if (header !== forwardForHeaderName) {
                    expect(finalHeaders[header]).toBe(headers[header]);
                }
            }

        };

        it('should include the first IP', function() {
            var remoteAddress = '127.0.0.1';
            testProxiedRequestHeaders(null, remoteAddress, remoteAddress);
        });

        it ('should include the second IP', function() {
            var previousForwardedFor = '192.168.1.1';
            var remoteAddress = '127.0.0.1';
            testProxiedRequestHeaders(previousForwardedFor, remoteAddress, previousForwardedFor + ',' + remoteAddress);
        });

        it('should not include a comma when the header is in blank', function() {
            var remoteAddress = '127.0.0.1';
            testProxiedRequestHeaders('', remoteAddress, remoteAddress);
        });
    });

    describe('Get API Port', function() {

        var testGetAPIPort = function(api) {
            var port = utils.getAPIPort(api);
            expect(port).toBe(config.endpoints[api].port);
        };
        
        it('should return correct port for catalog', function() {
            testGetAPIPort('catalog');
        });        

        it('should return correct port for ordering', function() {
            testGetAPIPort('ordering');
        });        

        it('should return correct port for inventory', function() {
            testGetAPIPort('inventory');
        });        

        it('should return correct port for charging', function() {
            testGetAPIPort('charging');
        });

        it('should return correct port for rss', function() {
            testGetAPIPort('rss');
        });
    });

    describe('Get Auth Token', function() {
        
        it('should return the token when X-Auth-Token included', function() {
     
            var expectedToken = 'EXAMPLE_OAUTH2_TOKEN';
            var headers = {'x-auth-token': expectedToken};

            var token = utils.getAuthToken(headers);

            expect(token).toBe(expectedToken);
        });

        it('should return the token when Authorization included', function() {

            var expectedToken = 'EXAMPLE_OAUTH2_TOKEN';
            var headers = {'authorization': 'Bearer ' + expectedToken};

            var token = utils.getAuthToken(headers);

            expect(token).toBe(expectedToken);

        });

        it('should throw expection when X-Auth-Token and Authorization is not included', function() {
            expect(utils.getAuthToken.bind(this, {})).toThrow({
                name: 'AuthorizationTokenNotFound',
                message: 'Auth-token not found in request headers'
            });
        });

        it('should throw expection when Authorization type is invalid', function() {
            var TOKEN_TYPE = 'basic';
            expect(utils.getAuthToken.bind(this, {'authorization': TOKEN_TYPE + ' example'}))
                    .toThrow({
                        name: 'InvalidAuthorizationTokenException',
                        message: 'Invalid Auth-Token type (' + TOKEN_TYPE + ')'
                    });
        });
    });

    describe('Send Unauthorized', function() {

        it('should return 401 and set the WWW-Authenticate header', function() {
            var res = jasmine.createSpyObj('res', ['status', 'send', 'set']);
            var errMsg = 'Example message';
            
            utils.sendUnauthorized(res, errMsg);

            // Check that response has been 
            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.set).toHaveBeenCalledWith('WWW-Authenticate', 'IDM uri = ' + config.oauth2.server);
            expect(res.send).toHaveBeenCalledWith({'error': errMsg});
        });

    });

    describe('Get ReturnTo Path', function() {

        var getBasicReq = function(hostname, port) {
            return {
                hostname: hostname,
                app: {
                    settings: {
                        port: port
                    }
                }
            };
        };

        it('should return no referer when referer is not set', function() {
            var req = getBasicReq('fiware.org', 8080);
            req.headers = {};
            req.query = {};
            expect(utils.getCameFrom(req)).toBe('/');
        });

        it('should return referer when hosts match', function() {

            var hostname = 'fiware.org';
            var port = 8080;
            var path = '/home/unit';
            var req = getBasicReq(hostname, port);

            req.query = {};
            req.headers = {
                'referer': 'http://' + hostname + ':' + port + path
            };

            expect(utils.getCameFrom(req)).toBe(path);
        });

        it('should not return referer when hostnames do not match', function() {

            var hostname1 = 'fiware.org';
            var hostname2 = 'nofiware.es';
            var port = 8080;
            var path = '/home/unit';
            var req = getBasicReq(hostname1, port);

            req.query = {};
            req.headers = {
                'referer': 'http://' + hostname2 + ':' + port + path
            };

            expect(utils.getCameFrom(req)).toBe('/');
        });

        it('should not return referer when ports do not match', function() {

            var hostname = 'fiware.org';
            var port1 = 8080;
            var port2 = 7777;
            var path = '/home/unit';
            var req = getBasicReq(hostname, port1);

            req.query = {};
            req.headers = {
                'referer': 'http://' + hostname + ':' + port2 + path
            };

            expect(utils.getCameFrom(req)).toBe('/');
        });

        it('should return came_from query param when defined', function() {

            var hostname = 'fiware.org';
            var port = 8080;
            var cameFrom = '/#/shopping-cart';

            var req = getBasicReq(hostname, port);
            req.query = { 'came_from': cameFrom };
            req.headers = {};

            expect(utils.getCameFrom(req)).toBe(cameFrom);
        });

        it('should return came_from query param when defined even if referer is valid', function() {

            var hostname = 'fiware.org';
            var port = 8080;
            var path = '/home/unit';
            var cameFrom = '/#/shopping-cart';
            var req = getBasicReq(hostname, port);

            req.query = { 'came_from': cameFrom };
            req.headers = {
                'referer': 'http://' + hostname + ':' + port + path
            };

            expect(utils.getCameFrom(req)).toBe(cameFrom);
        });


    });
});
