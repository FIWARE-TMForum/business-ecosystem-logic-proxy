var proxyquire =  require('proxyquire'),
    reporters = require('jasmine-reporters'),
    utils = require('../lib/utils');

describe('Utils', function() {

    var config = {
        oauth2: {
            server: 'https://account.lab.fiware.org'
        },
        endpoints: {
            'catalog': {
                'path': 'catalog',
                'port': '99'
            },
            'ordering': {
                'path': 'ordering',
                'port': '189'
            },
            'inventory': {
                'path': 'inventory',
                'port': '475'
            },
            'charging': {
                'path': 'charging',
                'port': '35'
            },
            'rss': {
                'path': 'rss',
                'port': '753'
            }
        }
    };

    var utils = proxyquire('../../lib/utils', { './../config.js': config });

    // Set up reporter
    var junitReporter = new reporters.JUnitXmlReporter({
        savePath: __dirname + '/../..',    // The main folder of the project
        consolidateAll: true,
        filePrefix: 'xunit'
    });
    jasmine.getEnv().addReporter(junitReporter);



    describe('Attach User Headers', function() {

        it('should include Nick Name and Display Name', function() {
            
            var headers = {};
            var userInfo = {
                id: 'user-1',
                displayName: 'User 1'
            };

            // This function should modify headers
            utils.attachUserHeaders(headers, userInfo);

            // Check that heacers has been modified appropriately
            expect(headers['X-Nick-Name']).toBe(userInfo.id);
            expect(headers['X-Display-Name']).toBe(userInfo.displayName);
        });
    });

    describe('Proxied Request Headers', function() {

        var executeTest = function(previousForwardedFor, remoteAddress, expectedForwardedFor) {

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
            executeTest(null, remoteAddress, remoteAddress);
        });

        it ('should include the second IP', function() {
            var previousForwardedFor = '192.168.1.1'
            var remoteAddress = '127.0.0.1';
            executeTest(previousForwardedFor, remoteAddress, previousForwardedFor + ',' + remoteAddress);
        });

        it('should not include a comma when the header is in blank', function() {
            var remoteAddress = '127.0.0.1';
            executeTest('', remoteAddress, remoteAddress);
        })
    });

    describe('Get App Port', function() {

        var executeTest = function(path, expectedPort) {            
            var port = utils.getAppPort({url: path});
            expect(port).toBe(expectedPort);

        }

        // Execute tests for all the registerd APIs
        for (var api in config.endpoints) {
            
            it('should return correct port for ' + api + ' API when subpath not included', function() {
                executeTest('/' + config.endpoints[api].path + '/', config.endpoints[api].port);
            });

            it('should return correct port for ' + api + ' API when subpath included', function() {
                executeTest('/' + config.endpoints[api].path + '/api/', config.endpoints[api].port);
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
            expect(utils.getAuthToken.bind(this, {})).toThrow('Auth-token not found in request headers');
        });

        it('should throw expection when Authorization type is invalid', function() {
            var TOKEN_TYPE = 'basic';
            expect(utils.getAuthToken.bind(this, {'authorization': TOKEN_TYPE + ' example'}))
                    .toThrow('Invalid Auth-Token type (' + TOKEN_TYPE + ')');
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
});