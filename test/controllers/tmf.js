/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the bae-logic-proxy-test of the
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


describe('TMF Controller', function() {

    var INVALID_API_STATUS = 401;
    var INVALID_API_MESSAGE = 'Not authorized to perform this operation';

    // Modified dependencies
    var config;
    var utils = {
        getAPIPort: function() {
            return 1234;
        },
        getAPIHost: function () {
            return 'example.com'
        },
        proxiedRequestHeaders: function() {
            return {
                'Authorization': 'Bearer EXAMPLE',
                'Accept': 'application/json'
            };
        },
        attachUserHeaders: function(headers, userInfo) {
            headers['X-Nick-Name'] = userInfo.id;
        }
    };

    var getDefaultHttpClient = function() {
        return jasmine.createSpy('request');
    };

    // Function to get a custom tmf.js instance
    var getTmfInstance = function(request, catalog, ordering, inventory, party, searchIndex) {

        if (!searchIndex) {
            searchIndex = {
                add: (a, cb) => {cb();},
                close: cb => {cb();},
                del: (key, cb) => {cb();},
                search: (q, cb) => {cb();}
            };
        }

        return proxyquire('../../controllers/tmf', {
            'request': request,
            './../config': config,
            './../lib/utils': utils,
            './../lib/logger': testUtils.emptyLogger,
            './tmf-apis/catalog': { catalog: catalog },
            './tmf-apis/ordering': {ordering: ordering},
            './tmf-apis/inventory': { inventory: inventory },
            './tnf-apis/party': { party: party },
            'search-index': searchIndex
        }).tmf;
    };

    // Clean configuration for every test
    beforeEach(function() {
        config = testUtils.getDefaultConfig();
    });

    describe('public paths', function() {

        var testPublic = function(protocol, method) {

            // TMF API
            var request = getDefaultHttpClient();
            var tmf = getTmfInstance(request);

            // Depending on the desired protocol, the config.appSsl var has to be set up
            utils.getAPIProtocol = function () {
                return protocol;
            };

            var path = '/example/url?a=b&c=d';

            var req = {
                apiUrl: path,
                body: 'This is an example',
                method: method,
                connection: { remoteAddress: '127.0.0.1' }
            };

            var res = {};

            tmf.public(req, res);

            var expectedOptions = {
                url: protocol + '://' + utils.getAPIHost() + ':' + utils.getAPIPort() + path,
                method: method,
                encoding: null,
                headers: utils.proxiedRequestHeaders(),
                body: req.body
            };

            expect(request).toHaveBeenCalledWith(expectedOptions, jasmine.any(Function));

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
    });

    describe('check permissions', function() {

        var checkPermissionsValid = function (req, callback) {
            callback();
        };

        var checkPermissionsInvalid = function (req, callback) {
            callback({
                status: INVALID_API_STATUS,
                message: INVALID_API_MESSAGE
            });
        };

        it('should return 404 for invalid API', function () {
            // TMF API
            var httpClient = getDefaultHttpClient();
            var tmf = getTmfInstance(httpClient);

            var req = {'apiUrl': '/nonexistingapi', headers: {}, connection: {remoteAddress: '127.0.0.1'}};
            var res = jasmine.createSpyObj('res', ['status', 'json', 'end']);

            tmf.checkPermissions(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({error: 'Path not found'});
            expect(res.end).toHaveBeenCalledWith();
        });

        var testApiReturnsError = function (api, done) {

            // Configure the API controller
            var controller = {checkPermissions: checkPermissionsInvalid};

            // TMF API. Only one API is set, the rest are set to null so we are sure the appropriate
            // one has been called
            var request = getDefaultHttpClient();
            var catalogController = api.startsWith(config.endpoints.catalog.path) ? controller : null;
            var orderingController = api.startsWith(config.endpoints.ordering.path) ? controller : null;
            var inventoryController = api.startsWith(config.endpoints.inventory.path) ? controller : null;
            var tmf = getTmfInstance(request, catalogController, orderingController, inventoryController);

            // Actual call
            var req = {apiUrl: '/' + api, headers: {}, connection: {remoteAddress: '127.0.0.1'}};
            var res = jasmine.createSpyObj('res', ['status', 'json', 'end']);
            tmf.checkPermissions(req, res);

            // We have to wait some time until the response has been called
            setTimeout(function () {
                expect(res.status).toHaveBeenCalledWith(INVALID_API_STATUS);
                expect(res.json).toHaveBeenCalledWith({error: INVALID_API_MESSAGE});
                expect(res.end).toHaveBeenCalledWith();

                expect(request).not.toHaveBeenCalled();

                done();

            }, 100);
        };

        it('should not redirect the request to the actual catalog API when controller rejects it', function (done) {
            testApiReturnsError('catalog', done);
        });

        it('should not redirect the request to the actual ordering API when controller rejects it', function (done) {
            testApiReturnsError('ordering', done);
        });

        it('should not redirect the request to the actual inventory API when controller rejects it', function (done) {
            testApiReturnsError('inventory', done);
        });

        var testApiOk = function (api, done) {

            // 'redirRequest' has been tested by testing the 'public' function. 'checkTmfPermissions'
            // is supposed to use the same function to redirect requests when they are allowed by the
            // API controller. For this reason, we do not check with other protocols or methods

            var protocol = 'http';
            utils.getAPIProtocol = function () {
                return protocol;
            };

            var method = 'GET';

            // Configure the API controller
            var controller = {checkPermissions: checkPermissionsValid};

            // TMF API
            var request = getDefaultHttpClient();
            var catalogController = api.startsWith(config.endpoints.catalog.path) ? controller : null;
            var orderingController = api.startsWith(config.endpoints.ordering.path) ? controller : null;
            var inventoryController = api.startsWith(config.endpoints.inventory.path) ? controller : null;
            var tmf = getTmfInstance(request, catalogController, orderingController, inventoryController);

            // Actual call
            var req = {
                apiUrl: '/' + api,
                body: 'Example',
                method: method,
                user: {'id': 'user'},
                headers: {},
                connection: {remoteAddress: '127.0.0.1'}
            };

            var res = jasmine.createSpyObj('res', ['status', 'json', 'end']);
            tmf.checkPermissions(req, res);

            setTimeout(function () {

                var expectedOptions = {
                    url: protocol + '://' + utils.getAPIHost() + ':' + utils.getAPIPort() + req.apiUrl,
                    method: method,
                    body: req.body,
                    encoding: null,
                    headers: utils.proxiedRequestHeaders()
                };

                expect(request).toHaveBeenCalledWith(expectedOptions, jasmine.any(Function));

                done();

            }, 100);
        };

        it('should redirect the request to the actual catalog API when controller does not reject it (root)', function (done) {
            testApiOk('catalog', done);
        });

        it('should redirect the request to the actual ordering API when controller does not reject it (root)', function (done) {
            testApiOk('ordering', done);
        });

        it('should redirect the request to the actual inventory API when controller does not reject it (root)', function (done) {
            testApiOk('inventory', done);
        });

        it('should redirect the request to the actual catalog API when controller does not reject it (non root)', function (done) {
            testApiOk('catalog/complex?a=b', done);
        });

        it('should redirect the request to the actual ordering API when controller does not reject it (non root)', function (done) {
            testApiOk('ordering/complex?a=b', done);
        });

        it('should redirect the request to the actual inventory API when controller does not reject it (non root)', function (done) {
            testApiOk('inventory/complex?a=b', done);
        });

    });

    describe('Proxy', function() {

        var reqMethod = 'POST';
        var secure = true;
        var hostname = 'belp.fiware.org';
        var reqBody = 'Example';
        var reqPath = '/ordering';
        var url = '/proxy' + reqPath;
        var userId = 'user';
        var reqId = 'EXAMPLE-REQUEST-ID';
        var connection = { remoteAddress: '127.0.0.1' };

        var executePostValidationOk = function(req, callback) {
            callback();
        };

        var executeValidationError = function(req, callback) {
            var err = {
                status: INVALID_API_STATUS,
                message: INVALID_API_MESSAGE
            };
            callback(err);
        };

        it('should return 504 when server is not available', function(done) {

            // Configure the API controller
            var controller = {
                checkPermissions: function(req, callback) {
                    callback();
                }
            };

            // TMF API
            var request = function(options, callback) {
                callback({ err: 'ECONNREFUSED' });
            };

            var tmf = getTmfInstance(request, null, controller, null);

            // Actual call
            var req = {
                apiUrl: '/ordering',
                body: 'Example',
                method: 'POST',
                user: {'id': 'user'},
                headers: {},
                connection: { remoteAddress: '127.0.0.1' }
            };

            var res = jasmine.createSpyObj('res', ['status', 'json']);
            res.status.and.returnValue(res);

            tmf.checkPermissions(req, res);

            setTimeout(function() {

                expect(res.status).toHaveBeenCalledWith(504);
                expect(res.json).toHaveBeenCalledWith({ error: 'Service unreachable' });

                done();

            }, 100);
        });

        var testPostAction = function(postValidationMethod, postValidator, responseCode, expectedPostValidatorCalled, error, done) {
            var methods = ['checkPermissions'];

            if (postValidator) {
                methods.push(postValidationMethod);
            }

            var controller = jasmine.createSpyObj('controller', methods);
            controller.checkPermissions.and.callFake((req, callback) => {
                callback(null);
            });

            if (postValidator) {
                controller[postValidationMethod].and.callFake((req, callback) => {
                    postValidator(req, callback);
                });
            }

            var returnedResponse = {
                statusCode: responseCode,
                headers: {
                    'content-type': 'application/json',
                    'accept': 'application/json',
                    'x-custom': 'custom-value'
                }
            };

            var returnedBody = '%%%%%%%%%---BODY---%%%%%%%%%';

            var request = jasmine.createSpy().and.callFake((options, callback) => {
                callback(null, returnedResponse, returnedBody);
            });

            var tmf = getTmfInstance(request, null, controller, null);

            var res = jasmine.createSpyObj('res', ['status', 'setHeader', 'json', 'write', 'end']);
            res.status.and.returnValue(res);

            var resMethod = error ? 'json': 'end';

            res[resMethod].and.callFake(() => {
                if (postValidator && expectedPostValidatorCalled) {
                    expect(controller[postValidationMethod]).toHaveBeenCalledWith({
                        secure: secure,
                        hostname: hostname,
                        status: returnedResponse.statusCode,
                        headers: returnedResponse.headers,
                        body: returnedBody,
                        user: { id: userId },
                        method: reqMethod,
                        apiUrl: reqPath,
                        url: url,
                        connection: connection,
                        id: reqId,
                        reqBody: reqBody
                    }, jasmine.any(Function));
                } else if (postValidator && !expectedPostValidatorCalled) {
                    expect(controller[postValidationMethod]).not.toHaveBeenCalled();
                }

                expect(request).toHaveBeenCalledWith({
                    url: 'http://' + utils.getAPIHost() + ':' + utils.getAPIPort() + reqPath,
                    method: 'POST',
                    encoding: null,
                    headers: utils.proxiedRequestHeaders(),
                    body: reqBody
                }, jasmine.any(Function));

                if (error) {

                    expect(res.status).toHaveBeenCalledWith(INVALID_API_STATUS);
                    expect(res.json).toHaveBeenCalledWith({ error: INVALID_API_MESSAGE });

                } else {

                    expect(res.status).toHaveBeenCalledWith(returnedResponse.statusCode);
                    expect(res.write).toHaveBeenCalledWith(returnedBody);
                    expect(res.end).toHaveBeenCalled();

                    for (var header in returnedResponse.headers) {
                        expect(res.setHeader).toHaveBeenCalledWith(header, returnedResponse.headers[header]);
                    }
                }

                done();
            });

            var req = {
                id: reqId,
                url: url,
                apiUrl: reqPath,
                //path: reqPath,
                body: reqBody,
                hostname: hostname,
                secure: secure,
                method: reqMethod,
                user: {'id': userId },
                headers: {},
                connection: connection
            };

            tmf.checkPermissions(req, res);
        };

        var testAPIPostValidation = function(postValidator, responseCode, expectedPostValidatorCalled, error, done) {
            testPostAction('executePostValidation', postValidator, responseCode, expectedPostValidatorCalled, error, done);
        };

        it('should proxy request when no post validation method defined', function(done) {
           testAPIPostValidation(null, 200, false, false, done);
        });

        it('should not call post validation when return status is higher than 400', function(done) {
            testAPIPostValidation(jasmine.createSpy(), 404, false, false, done);
        });

        it ('should inject extra headers after calling post validation method', function(done) {
            testAPIPostValidation(executePostValidationOk, 200, true, false, done);
        });

        it('should send an error message after executing post validation method', function(done) {
            testAPIPostValidation(executeValidationError, 200, true, true, done);
        });

        var testAPIErrorHandling = function(postValidator, responseCode, expectedPostValidatorCalled, error, done) {
            testPostAction('handleAPIError', postValidator, responseCode, expectedPostValidatorCalled, error, done);
        };

        it('should proxy request when no API error handler has been defined', function(done) {
            testAPIErrorHandling(null, 500, false, false, done);
        });

        it('should call API error handler when the error code is higher than 400 and is defined', function (done) {
            testAPIErrorHandling(executePostValidationOk, 500, true, false, done);
        });

        it('should call API error handler and return an error given in the handler', function (done) {
            testAPIErrorHandling(executeValidationError, 500, true, true, done);
        });
    });

});
