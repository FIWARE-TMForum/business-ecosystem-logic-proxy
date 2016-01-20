var proxyquire =  require('proxyquire'),
    testUtils = require('../utils');


describe('Utils', function() {

    var config = testUtils.getDefaultConfig();
    var utils = proxyquire('../../lib/utils', { './../config.js': config });

    describe('Attach User Headers', function() {

        it('should include Nick Name and Display Name', function() {
            
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

        }

        it('should include the first IP', function() {
            var remoteAddress = '127.0.0.1';
            testProxiedRequestHeaders(null, remoteAddress, remoteAddress);
        });

        it ('should include the second IP', function() {
            var previousForwardedFor = '192.168.1.1'
            var remoteAddress = '127.0.0.1';
            testProxiedRequestHeaders(previousForwardedFor, remoteAddress, previousForwardedFor + ',' + remoteAddress);
        });

        it('should not include a comma when the header is in blank', function() {
            var remoteAddress = '127.0.0.1';
            testProxiedRequestHeaders('', remoteAddress, remoteAddress);
        })
    });

    describe('Get API Port', function() {

        var testgetAPIPort = function(api, expectedPort) {
            var port = utils.getAPIPort(api);
            expect(port).toBe(expectedPort);
        };

        // Execute tests for all the registerd APIs
        for (var api in config.endpoints) {
            
            it('should return correct port for ' + api, function() {
                testgetAPIPort(api, config.endpoints[api].port);
            });
        }
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

    describe('Get Referer Path', function() {

        var getBasicReq = function(hostname, port) {
            return {
                hostname: hostname,
                app: {
                    settings: {
                        port: port
                    }
                }
            }
        };

        it('should return no referer when referer is not set', function() {
            var req = getBasicReq('fiware.org', 8080);
            req.headers = {};
            expect(utils.getRefererPath(req)).toBe('/');
        });

        it('should return referer when hosts match', function() {

            var hostname = 'fiware.org';
            var port = 8080;
            var path = '/home/unit';
            var req = getBasicReq(hostname, port);

            req.headers = {
                'referer': 'http://' + hostname + ':' + port + path
            };

            expect(utils.getRefererPath(req)).toBe(path);
        });

        it('should not return referer when hostnames do not match', function() {

            var hostname1 = 'fiware.org';
            var hostname2 = 'nofiware.es';
            var port = 8080;
            var path = '/home/unit';
            var req = getBasicReq(hostname1, port);

            req.headers = {
                'referer': 'http://' + hostname2 + ':' + port + path
            };

            expect(utils.getRefererPath(req)).toBe('/');
        });

        it('should not return referer when ports do not match', function() {

            var hostname = 'fiware.org';
            var port1 = 8080;
            var port2 = 7777;
            var path = '/home/unit';
            var req = getBasicReq(hostname, port1);

            req.headers = {
                'referer': 'http://' + hostname + ':' + port2 + path
            };

            expect(utils.getRefererPath(req)).toBe('/');
        });


    })
});