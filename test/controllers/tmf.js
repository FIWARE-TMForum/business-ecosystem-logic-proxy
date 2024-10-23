/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Colsulting and Development Solutions S.L.
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

const proxyquire = require('proxyquire');
const testUtils = require('../utils');

describe('TMF Controller', function() {
    const INVALID_API_STATUS = 401;
    const INVALID_API_MESSAGE = 'Not authorized to perform this operation';

    // Modified dependencies
    let config;
    const utils = {
        log: function() {},
        getAPIPort: function() {
            return 1234;
        },
        getAPIHost: function() {
            return 'example.com';
        },
        proxiedRequestHeaders: function() {
            return {
                Authorization: 'Bearer EXAMPLE',
                Accept: 'application/json'
            };
        },
        attachUserHeaders: function(headers, userInfo) {
            headers['X-Nick-Name'] = userInfo.partyId;
        }
    };

    const getDefaultHttpClient = function(response) {
        const mock = jasmine.createSpyObj('axios', ['request']);
        mock.request.and.returnValue(Promise.resolve(response))
        return mock
    };

    // Function to get a custom tmf.js instance
    const getTmfInstance = function(request, catalog, ordering, inventory, party) {
        return proxyquire('../../controllers/tmf', {
            axios: request,
            './../config': config,
            './../lib/utils': utils,
            './../lib/logger': testUtils.emptyLogger,
            './tmf-apis/catalog': { catalog: catalog },
            './tmf-apis/ordering': { ordering: ordering },
            './tmf-apis/inventory': { inventory: inventory },
            './tnf-apis/party': { party: party }
        }).tmf();
    };

    // Clean configuration for every test
    beforeEach(function() {
        config = testUtils.getDefaultConfig();
    });

    describe('public paths', function() {
        const testPublic = function(protocol, method, done) {
            // TMF API
            const respStatus = 200
            const resData = {res: 'Response text'}
            const request = getDefaultHttpClient({
                status: respStatus,
                data: resData,
                headers: {
                    'content-type': 'application/json'
                }
            });
            const tmf = getTmfInstance(request);

            // Depending on the desired protocol, the config.appSsl var has to be set up
            utils.getAPIProtocol = function() {
                return protocol;
            };

            const path = '/example/url?a=b&c=d';

            const req = {
                apiUrl: path,
                body: 'This is an example',
                method: method,
                connection: { remoteAddress: '127.0.0.1' },
                get: () => {
                    return false
                }
            };

            const res = jasmine.createSpyObj('res', ['status', 'json', 'setHeader']);

            const expectedOptions = {
                url: protocol + '://' + utils.getAPIHost() + ':' + utils.getAPIPort() + path,
                method: method,
                headers: utils.proxiedRequestHeaders(),
                data: req.body
            };

            // Check calls when calling the json method as this is async
            res.json.and.callFake(() => {
                expect(request.request).toHaveBeenCalledWith(expectedOptions);
                expect(res.status).toHaveBeenCalledWith(respStatus)
                expect(res.json).toHaveBeenCalledWith(resData)
                done();
            })

            // Call the tested method
            tmf.public(req, res);
        };

        it('should redirect HTTP GET requests', function(done) {
            testPublic('http', 'GET', done);
        });

        it('should redirect HTTP POST requests', function(done) {
            testPublic('http', 'POST', done);
        });

        it('should redirect HTTP PUT requests', function(done) {
            testPublic('http', 'PUT', done);
        });

        it('should redirect HTTP PATCH requests', function(done) {
            testPublic('http', 'PATCH', done);
        });

        it('should redirect HTTP DELETE requests', function(done) {
            testPublic('http', 'DELETE', done);
        });

        it('should redirect HTTPS GET requests', function(done) {
            testPublic('https', 'GET', done);
        });

        it('should redirect HTTPS POST requests', function(done) {
            testPublic('https', 'POST', done);
        });

        it('should redirect HTTPS PUT requests', function(done) {
            testPublic('https', 'PUT', done);
        });

        it('should redirect HTTPS PATCH requests', function(done) {
            testPublic('https', 'PATCH', done);
        });

        it('should redirect HTTPS DELETE requests', function(done) {
            testPublic('https', 'DELETE', done);
        });
    });

    describe('check permissions', function() {
        const checkPermissionsValid = function(req, callback) {
            callback();
        };

        const checkPermissionsInvalid = function(req, callback) {
            callback({
                status: INVALID_API_STATUS,
                message: INVALID_API_MESSAGE
            });
        };

        it('should return 404 for invalid API', function() {
            // TMF API
            const httpClient = getDefaultHttpClient();
            const tmf = getTmfInstance(httpClient);

            const req = { apiUrl: '/nonexistingapi', headers: {}, connection: { remoteAddress: '127.0.0.1' } };
            const res = jasmine.createSpyObj('res', ['status', 'json', 'end']);

            tmf.checkPermissions(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Path not found' });
            expect(res.end).toHaveBeenCalledWith();
        });

        const testApiReturnsError = function(api, done) {
            // Configure the API controller
            const controller = { checkPermissions: checkPermissionsInvalid };

            // TMF API. Only one API is set, the rest are set to null so we are sure the appropriate
            // one has been called
            const request = getDefaultHttpClient();
            const catalogController = api.startsWith(config.endpoints.catalog.path) ? controller : null;
            const orderingController = api.startsWith(config.endpoints.ordering.path) ? controller : null;
            const inventoryController = api.startsWith(config.endpoints.inventory.path) ? controller : null;
            const tmf = getTmfInstance(request, catalogController, orderingController, inventoryController);

            // Actual call
            const req = { apiUrl: '/' + api, headers: {}, connection: { remoteAddress: '127.0.0.1' } };
            const res = jasmine.createSpyObj('res', ['status', 'json', 'end']);

            // Validate calls after the end method is called
            res.end.and.callFake(() => {
                expect(res.status).toHaveBeenCalledWith(INVALID_API_STATUS);
                expect(res.json).toHaveBeenCalledWith({ error: INVALID_API_MESSAGE });
                expect(res.end).toHaveBeenCalledWith();

                expect(request.request).not.toHaveBeenCalled();

                done();
            })

            // Call the tested method
            tmf.checkPermissions(req, res);
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

        const testApiOk = function(api, path, done, opts) {
            // 'redirRequest' has been tested by testing the 'public' function. 'checkTmfPermissions'
            // is supposed to use the same function to redirect requests when they are allowed by the
            // API controller. For this reason, we do not check with other protocols or methods

            const protocol = 'http';
            utils.getAPIProtocol = function() {
                return protocol;
            };

            const method = 'GET';

            // Configure the API controller
            const controller = { checkPermissions: checkPermissionsValid };

            // TMF API
            const respStatus = 200
            const respData = {resp: 'Response content'}
            const request = getDefaultHttpClient({
                status: respStatus,
                data: respData,
                headers: {
                    'content-type': 'application/json'
                }
            });

            const catalogController = api.startsWith(config.endpoints.catalog.path) ? controller : null;
            const orderingController = api.startsWith(config.endpoints.ordering.path) ? controller : null;
            const inventoryController = api.startsWith(config.endpoints.inventory.path) ? controller : null;
            const tmf = getTmfInstance(request, catalogController, orderingController, inventoryController);
     

            // Actual call
            const req = {
                apiUrl: '/' + api + path,
                path: '/' + api + path.split("?")[0],
                body: 'Example',
                method: method,
                user: { id: 'user' },
                headers: {},
                connection: { remoteAddress: '127.0.0.1' },
                get: () => {
                    return 'true'
                }
            };

            const res = jasmine.createSpyObj('res', ['status', 'json', 'setHeader']);

            expectPath = path
            if (typeof opts != "undefined" && opts['expectedPath']) {
                expectPath = opts['expectedPath']
            }

            const expectedOptions = {
                url: protocol + '://' + utils.getAPIHost() + ':' + utils.getAPIPort() + expectPath,
                method: method,
                data: req.body,
                headers: utils.proxiedRequestHeaders()
            };

            res.json.and.callFake(() => {
                expect(request.request).toHaveBeenCalledWith(expectedOptions);
                expect(res.status).toHaveBeenCalledWith(respStatus)
                expect(res.json).toHaveBeenCalledWith(respData)

                done();
            })
            tmf.checkPermissions(req, res);
        };

        it('should redirect the request to the actual catalog API when controller does not reject it (root)', function(done) {
            // when requesting the resource "catalog", it needs to stay in the request
            testApiOk('catalog', '/catalog', done);
        });

        it('should redirect the request to the actual catalog API when controller does not reject it (sub-resource)', function(done) {
            testApiOk('catalog', '/catalog/some-id/productSpecification', done, { 'expectedPath': '/productSpecification' });
        });

        it('should redirect the request to the actual ordering API when controller does not reject it (root)', function(done) {
            testApiOk('ordering', '', done);
        });

        it('should redirect the request to the actual inventory API when controller does not reject it (root)', function(done) {
            testApiOk('inventory', '', done);
        });

        it('should redirect the request to the actual catalog API when controller does not reject it (non root)', function(done) {
            testApiOk('catalog', '/complex?a=b', done);
        });

        it('should redirect the request to the actual ordering API when controller does not reject it (non root)', function(done) {
            testApiOk('ordering', '/complex?a=b', done);
        });

        it('should redirect the request to the actual inventory API when controller does not reject it (non root)', function(done) {
            testApiOk('inventory', '/complex?a=b', done);
        });
    });

    describe('Proxy', function() {
        const reqMethod = 'POST';
        const secure = true;
        const hostname = 'belp.fiware.org';
        const reqBody = 'Example';
        const reqPath = '/ordering';
        const url = '/proxy' + reqPath;
        const userId = 'user';
        const reqId = 'EXAMPLE-REQUEST-ID';
        const connection = { remoteAddress: '127.0.0.1' };

        const executePostValidationOk = function(req, callback) {
            callback();
        };

        const executeValidationError = function(req, callback) {
            const err = {
                status: INVALID_API_STATUS,
                message: INVALID_API_MESSAGE
            };
            callback(err);
        };

        it('should return 504 when server is not available', function(done) {
            // Configure the API controller
            const controller = {
                checkPermissions: function(req, callback) {
                    callback();
                }
            };

            // TMF API
            const request = jasmine.createSpyObj('axios', ['request']);
            request.request.and.returnValue(Promise.reject({ err: 'ECONNREFUSED' }))

            const tmf = getTmfInstance(request, null, controller, null);

            // Actual call
            const req = {
                apiUrl: '/ordering',
                body: 'Example',
                method: 'POST',
                user: { id: 'user' },
                headers: {},
                connection: { remoteAddress: '127.0.0.1' }
            };

            const res = jasmine.createSpyObj('res', ['status', 'json']);
            res.status.and.returnValue(res)
            res.json.and.callFake(() => {
                expect(res.status).toHaveBeenCalledWith(504);
                expect(res.json).toHaveBeenCalledWith({ error: 'Service unreachable' });

                done();
            })

            tmf.checkPermissions(req, res);
        });

        const testPostAction = function(
            postValidationMethod,
            postValidator,
            responseCode,
            expectedPostValidatorCalled,
            error,
            done
        ) {
            const methods = ['checkPermissions'];

            if (postValidator) {
                methods.push(postValidationMethod);
            }

            const controller = jasmine.createSpyObj('controller', methods);
            controller.checkPermissions.and.callFake((req, callback) => {
                callback(null);
            });

            if (postValidator) {
                controller[postValidationMethod].and.callFake((req, callback) => {
                    postValidator(req, callback);
                });
            }

            const returnedBody = '%%%%%%%%%---BODY---%%%%%%%%%';
            const returnedResponse = {
                status: responseCode,
                headers: {
                    'content-type': 'application/json',
                    accept: 'application/json',
                    'x-custom': 'custom-value'
                },
                data: returnedBody
            };

            const request = jasmine.createSpyObj("request", ["request"])
            request.request.and.returnValue(Promise.resolve(returnedResponse));

            const tmf = getTmfInstance(request, null, controller, null);

            const res = jasmine.createSpyObj('res', ['status', 'setHeader', 'json', 'write', 'end']);
            res.status.and.returnValue(res);

            res.json.and.callFake(() => {
                if (postValidator && expectedPostValidatorCalled) {
                    expect(controller[postValidationMethod]).toHaveBeenCalledWith(
                        {
                            secure: secure,
                            hostname: hostname,
                            status: returnedResponse.status,
                            headers: returnedResponse.headers,
                            body: returnedBody,
                            user: { id: userId },
                            method: reqMethod,
                            apiUrl: reqPath,
                            url: url,
                            connection: connection,
                            id: reqId,
                            reqBody: reqBody,
                            query: undefined
                        },
                        jasmine.any(Function)
                    );
                } else if (postValidator && !expectedPostValidatorCalled) {
                    expect(controller[postValidationMethod]).not.toHaveBeenCalled();
                }

                expect(request.request).toHaveBeenCalledWith(
                    {
                        url: 'http://' + utils.getAPIHost() + ':' + utils.getAPIPort(),
                        method: 'POST',
                        headers: utils.proxiedRequestHeaders(),
                        data: reqBody
                    }
                );

                if (error) {
                    expect(res.status).toHaveBeenCalledWith(INVALID_API_STATUS);
                    expect(res.json).toHaveBeenCalledWith({ error: INVALID_API_MESSAGE });
                } else {
                    expect(res.status).toHaveBeenCalledWith(returnedResponse.status);
                    expect(res.json).toHaveBeenCalledWith(returnedBody);

                    for (let header in returnedResponse.headers) {
                        expect(res.setHeader).toHaveBeenCalledWith(header, returnedResponse.headers[header]);
                    }
                }

                done();
            });

            const req = {
                id: reqId,
                url: url,
                apiUrl: reqPath,
                // path: reqPath,
                body: reqBody,
                hostname: hostname,
                secure: secure,
                method: reqMethod,
                user: { id: userId },
                headers: {},
                connection: connection,
                get: jasmine.createSpy('get')
            };

            tmf.checkPermissions(req, res);
        };

        const testAPIPostValidation = function(postValidator, responseCode, expectedPostValidatorCalled, error, done) {
            testPostAction(
                'executePostValidation',
                postValidator,
                responseCode,
                expectedPostValidatorCalled,
                error,
                done
            );
        };

        it('should proxy request when no post validation method defined', function(done) {
            testAPIPostValidation(null, 200, false, false, done);
        });

        it('should not call post validation when return status is higher than 400', function(done) {
            testAPIPostValidation(jasmine.createSpy(), 404, false, false, done);
        });

        it('should inject extra headers after calling post validation method', function(done) {
            testAPIPostValidation(executePostValidationOk, 200, true, false, done);
        });

        it('should send an error message after executing post validation method', function(done) {
            testAPIPostValidation(executeValidationError, 200, true, true, done);
        });

        const testAPIErrorHandling = function(postValidator, responseCode, expectedPostValidatorCalled, error, done) {
            testPostAction('handleAPIError', postValidator, responseCode, expectedPostValidatorCalled, error, done);
        };

        it('should proxy request when no API error handler has been defined', function(done) {
            testAPIErrorHandling(null, 500, false, false, done);
        });

        it('should call API error handler when the error code is higher than 400 and is defined', function(done) {
            testAPIErrorHandling(executePostValidationOk, 500, true, false, done);
        });

        it('should call API error handler and return an error given in the handler', function(done) {
            testAPIErrorHandling(executeValidationError, 500, true, true, done);
        });
    });
});
