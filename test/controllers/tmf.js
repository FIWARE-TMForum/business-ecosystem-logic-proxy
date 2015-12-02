var proxyquire =  require('proxyquire'),
    testUtils = require('../utils');


describe('TMF Controller', function() {

    var INVALID_API_STATUS = 401;
    var INVALID_API_MESSAGE = 'Not authorized to perform this operation';

    // Modified dependencies
    var config;
    var utils = {
        getAppPort: function() {
            return 1234;
        },
        proxiedRequestHeaders: function() {
            return {
                'Authorization': 'Bearer EXAMPLE',
                'Accept': 'application/json'
            }
        },
        attachUserHeaders: function(headers, userInfo) {
            headers['X-Nick-Name'] = userInfo.id;
        }
    };

    var getDefaultHttpClient = function() {
        return jasmine.createSpyObj('httpClient', ['proxyRequest']);
    };

    // Function to get a custom tmf.js instance
    var getTmfInstance = function(httpClient, catalog, ordering, inventory) {

        return proxyquire('../../controllers/tmf', {
            './../lib/httpClient': httpClient, 
            './../config': config, 
            './../lib/utils': utils,
            './../lib/logger': testUtils.emptyLogger,
            './tmf-apis/catalog': { catalog: catalog },
            './tmf-apis/ordering': {ordering: ordering},
            './tmf-apis/inventory': { inventory: inventory }
        }).tmf;
    };

    // Clean configuration for every test
    beforeEach(function() {
        config = testUtils.getDefaultConfig();
    });

    describe('public paths', function() {

        var testPublic = function(protocol, method, proxyPrefix) {

            proxyPrefix = proxyPrefix === undefined ? '' : proxyPrefix;

            // TMF API
            var httpClient = getDefaultHttpClient();
            var tmf = getTmfInstance(httpClient);

            // Depending on the desired protocol, the config.appSsl var has to be set up
            config.appSsl = protocol === 'https' ? true : false;
            config.proxyPrefix = proxyPrefix;
            var path = '/example/url?a=b&c=d';

            var req = {
                url: proxyPrefix + path,
                body: 'This is an example',
                method: method
            };

            var res = {};

            tmf.public(req, res);

            var expectedOptions = {
                host: config.appHost,
                port: utils.getAppPort(),
                path: path,
                method: method,
                headers: utils.proxiedRequestHeaders()
            };

            expect(httpClient.proxyRequest).toHaveBeenCalledWith(protocol, expectedOptions, req.body, res, null);

        };

        it('should redirect HTTP GET requests', function() {
            testPublic('http', 'GET');
        });

        it('should redirect HTTP POST requests', function() {
            testPublic('http', 'POST');
        });

        it('should redirect HTTP PUT requests', function() {
            testPublic('http', 'PUT');
        });

        it('should redirect HTTP PATCH requests', function() {
            testPublic('http', 'PATCH');
        });

        it('should redirect HTTP DELETE requests', function() {
            testPublic('http', 'DELETE');
        });

        it('should redirect HTTPS GET requests', function() {
            testPublic('https', 'GET');
        });

        it('should redirect HTTPS POST requests', function() {
            testPublic('https', 'POST');
        });

        it('should redirect HTTPS PUT requests', function() {
            testPublic('https', 'PUT');
        });

        it('should redirect HTTPS PATCH requests', function() {
            testPublic('https', 'PATCH');
        });

        it('should redirect HTTPS DELETE requests', function() {
            testPublic('https', 'DELETE');
        });

        it('should redirect to the correct path if proxy path is not empty', function() {
            testPublic('http', 'GET', '/proxy');
        });

    });

    describe('check permissions', function() {

        var checkPermissionsValid = function(req, callback) {
            callback();
        };

        var checkPermissionsInvalid = function(req, callback) {
            callback({
                status: INVALID_API_STATUS,
                message: INVALID_API_MESSAGE
            });
        };

        it('should return 404 for invalid API', function() {
            // TMF API
            var httpClient = getDefaultHttpClient();
            var tmf = getTmfInstance(httpClient);

            var req = { 'url': 'http://example.com/nonexistingapi' };
            var res = jasmine.createSpyObj('res', ['status', 'send', 'end']);

            tmf.checkPermissions(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.send).toHaveBeenCalledWith({ error: 'Path not found' });
            expect(res.end).toHaveBeenCalledWith();
        });

        var testApiReturnsError = function(api, done) {

            // Configure the API controller
            var controller = { checkPermissions: checkPermissionsInvalid }; 

            // TMF API. Only one API is set, the rest are set to null so we are sure the appropriate
            // one has been called
            var httpClient = getDefaultHttpClient();
            var catalogController = api.startsWith(config.endpoints.catalog.path) ? controller : null;
            var orderingController = api.startsWith(config.endpoints.ordering.path) ? controller : null;
            var inventoryController = api.startsWith(config.endpoints.inventory.path) ? controller : null;
            var tmf = getTmfInstance(httpClient, catalogController, orderingController, inventoryController);

            // Actual call
            var req = { url: 'http://example.com/' + api };
            var res = jasmine.createSpyObj('res', ['status', 'send', 'end']);
            tmf.checkPermissions(req, res);

            // We have to wait some time until the response has been called
            setTimeout(function() {
                expect(res.status).toHaveBeenCalledWith(INVALID_API_STATUS);
                expect(res.send).toHaveBeenCalledWith({ error: INVALID_API_MESSAGE });
                expect(res.end).toHaveBeenCalledWith();

                expect(httpClient.proxyRequest).not.toHaveBeenCalled();

                done();

            }, 100);
        };

        it('should not redirect the request to the actual catalog API when controller rejects it', function(done) {
            testApiReturnsError('catalog', done);
        });

        it('should not redirect the request to the actual ordering API when controller rejects it', function(done) {
            testApiReturnsError('ordering', done);
        });

        it('should not redirect the request to the actual inventory API when controller rejects it', function(done) {
            testApiReturnsError('inventory', done);
        });

        var testApiOk = function(api, done) {
            
            // 'redirRequest' has been tested by testing the 'public' function. 'checkTmfPermissions'
            // is supposed to use the same function to redirect requests when they are allowed by the
            // API controller. For this reason, we do not check with other protocols or methods

            var protocol = 'http';
            var method = 'GET';

            // Configure the API controller
            var controller = { checkPermissions: checkPermissionsValid }; 

            // TMF API
            var httpClient = getDefaultHttpClient();
            var catalogController = api.startsWith(config.endpoints.catalog.path) ? controller : null;
            var orderingController = api.startsWith(config.endpoints.ordering.path) ? controller : null;
            var inventoryController = api.startsWith(config.endpoints.inventory.path) ? controller : null;
            var tmf = getTmfInstance(httpClient, catalogController, orderingController, inventoryController);

            // Actual call
            var req = { 
                url: 'http://example.com/' + api, 
                body: 'Example', 
                method: method, 
                user: {'id': 'user'}, 
                headers: {} 
            };
            
            var res = jasmine.createSpyObj('res', ['status', 'send', 'end']);
            tmf.checkPermissions(req, res);

            setTimeout(function() {

                var expectedOptions = {
                    host: config.appHost,
                    port: utils.getAppPort(),
                    path: req.url,
                    method: method,
                    headers: utils.proxiedRequestHeaders()
                };

                expect(httpClient.proxyRequest).toHaveBeenCalledWith(protocol, expectedOptions, req.body, res, null);

                done();

            }, 100);
        };

        it('should redirect the request to the actual catalog API when controller does not reject it (root)', function(done) {
            testApiOk('catalog', done);
        });

        it('should redirect the request to the actual ordering API when controller does not reject it (root)', function(done) {
            testApiOk('ordering', done);
        });

        it('should redirect the request to the actual inventory API when controller does not reject it (root)', function(done) {
            testApiOk('inventory', done);
        });

        it('should redirect the request to the actual catalog API when controller does not reject it (non root)', function(done) {
            testApiOk('catalog/complex?a=b', done);
        });

        it('should redirect the request to the actual ordering API when controller does not reject it (non root)', function(done) {
            testApiOk('ordering/complex?a=b', done);
        });

        it('should redirect the request to the actual inventory API when controller does not reject it (non root)', function(done) {
            testApiOk('inventory/complex?a=b', done);
        });


        var executePostValidationOk = function(req, callback) {
            var response = {
                extraHdrs: {
                    'X-Redirect-URL': 'http://redirecturl.com'
                }
            };
            callback(null, response)
        };

        var executeValidationError = function(req, callback) {
            var err = {
                status: INVALID_API_STATUS,
                message: INVALID_API_MESSAGE
            };
            callback(err);
        };

        var testAPIPostValidation = function(postValidator, error,  done) {

            // Configure the API controller
            var controller = {
                checkPermissions: checkPermissionsValid,
                executePostValidation: postValidator
            };

            var proxyCallback = jasmine.createSpy('callback');
            var proxyRequest = function(protocol, options, data, proxiedRes, postAction) {
                postAction(proxyCallback);
            };

            // TMF API
            var httpClient = getDefaultHttpClient();
            httpClient.proxyRequest = proxyRequest;

            var tmf = getTmfInstance(httpClient, null, controller, null);

            // Actual call
            var req = {
                url: 'http://example.com/ordering',
                body: 'Example',
                method: 'POST',
                user: {'id': 'user'},
                headers: {}
            };

            var res = jasmine.createSpyObj('res', ['status', 'send', 'end']);

            tmf.checkPermissions(req, res);

            setTimeout(function() {
                if (error) {
                    expect(res.status).toHaveBeenCalledWith(INVALID_API_STATUS);
                    expect(res.send).toHaveBeenCalledWith({ error: INVALID_API_MESSAGE });
                    expect(res.end).toHaveBeenCalledWith();

                    expect(proxyCallback).not.toHaveBeenCalled();
                } else {
                    expect(proxyCallback).toHaveBeenCalledWith({
                        'X-Redirect-URL': 'http://redirecturl.com'
                    });
                }
                done();

            }, 100);
        };

        it ('should inject extra headers after calling post validation method', function(done) {
            testAPIPostValidation(executePostValidationOk, false, done);
        });

        it('should send an error message after executing post validation method', function(done) {
            testAPIPostValidation(executeValidationError, true, done);
        })
    });

});