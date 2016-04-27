var proxyquire = require('proxyquire').noCallThru();

describe('Usage Management API', function () {

    var getUsageManagementAPI = function (accountingService, storeClient, utils) {
        return proxyquire('../../../controllers/tmf-apis/usageManagement', {
            './../../db/schemas/accountingService': accountingService,
            './../../lib/store': storeClient,
            './../../lib/utils': utils
        }).usageManagement;
    }

    describe('Check Permissions', function () {

        //////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////// NOT ALLOWED ////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        describe('Not allowed methods', function () {

            var methodNotAllowedStatus = 405;
            var methodNotAllowedMessage = 'This method used is not allowed in the accessed API';

            var methodNotAllowed = function (req, callback) {
                return callback ({
                    status: methodNotAllowedStatus,
                    message: methodNotAllowedMessage
                });
            };

            var testMethodNotAllowed = function (method, done) {

                var utils = {
                    methodNotAllowed: methodNotAllowed
                };

                var usageManagementAPI = getUsageManagementAPI({}, {}, utils);

                var path = '/apiKeys';

                var req = {
                    method: method,
                    url: path
                };

                usageManagementAPI.checkPermissions(req, function (err) {

                    expect(err).not.toBe(null);
                    expect(err.status).toBe(methodNotAllowedStatus);
                    expect(err.message).toBe(methodNotAllowedMessage);

                    done();
                });
            };

            it('should reject PUT requests', function (done) {
                testMethodNotAllowed('PUT', done);
            });

            it('should reject PUT requests', function (done) {
                testMethodNotAllowed('PATCH', done);
            });

            it('should reject PUT requests', function (done) {
                testMethodNotAllowed('DELETE', done);
            });

        });

        //////////////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////// NOT AUTHENTICATED /////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////
        
        describe('Not Authenticated Requests', function () {

            var requestNotAuthenticatedStatus = 401;
            var requestNotAuthenticatedMessage = 'You need to be authenticated to create/update/delete resources';

            var validateLoggedError = function (req, callback) {
                return callback({
                    status: requestNotAuthenticatedStatus,
                    message: requestNotAuthenticatedMessage
                });
            };

            var testNotLoggedIn = function (method, done) {

                var utils = {
                    validateLoggedIn: validateLoggedError
                };

                var usageManagementAPI = getUsageManagementAPI({}, {}, utils);
                var path = '/apiKeys';

                var req = {
                    method: method,
                    url: path
                };

                usageManagementAPI.checkPermissions(req, function (err) {

                    expect(err).not.toBe(null);
                    expect(err.status).toBe(requestNotAuthenticatedStatus);
                    expect(err.message).toBe(requestNotAuthenticatedMessage);

                    done();
                });
            };

            it('should reject not authenticated GET requests', function (done) {
                testNotLoggedIn('GET', done);
            });
        });

        //////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////// RETRIEVAL //////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////
        
        describe('GET', function () {

            var testRelatedParty = function (req, done) {

                 var utils = {
                    validateLoggedIn: function (req, callback) {
                        return callback(); 
                    }
                };

                var usageManagementAPI = getUsageManagementAPI({}, {}, utils);

                usageManagementAPI.checkPermissions(req, function (err) {
                    expect(req.query.relatedParty.id).toBe(req.user.id);
                    done();
                });
            };

            it('should add the user id to the "relatedParty" query string', function (done) {
                var userId = 'userId';
                var req = {
                    method: 'GET',
                    url: '/apiKeys',
                    query: {},
                    user: {
                        id: userId
                    }
                };

                testRelatedParty(req, done);
            });

            it('should permit request with the correct related party', function (done) {
                var userId = 'userId';
                var req = {
                    method: 'GET',
                    url: '/apiKeys',
                    query: {
                        relatedParty: {
                            id: userId
                        } 
                    },
                    user: {
                        id: userId
                    }
                };

                testRelatedParty(req, done);
            });

            it('should reject requests with invalid relatedParty', function (done) {

                var utils = {
                    validateLoggedIn: function (req, callback) {
                        return callback(); 
                    }
                };

                var req = {
                    method: 'GET',
                    url: '/apiKeys',
                    query: {
                        relatedParty: {
                            id: 'wrong_user'
                        },
                    },
                    user: {
                        id: 'userId'
                    }
                };

                var usageManagementAPI = getUsageManagementAPI({}, {}, utils);

                usageManagementAPI.checkPermissions(req, function (err) {
                    expect(err).not.toBe(null);
                    expect(err.status).toBe(401);
                    expect(err.message).toBe('Invalid relatedParty');

                    done();
                });
            });
        });

        //////////////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////// CREATION //////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////
        
        describe('Creation', function () {

            var testValidateApiKey = function (accountingService, headers, statusExpected, messageExpected, done) {

                var usageManagementAPI = getUsageManagementAPI(accountingService, {}, {});
                var path = '/apiKey';

                var req = {
                    method: 'POST',
                    headers: headers,
                    get: function (header) {
                        return this.headers[header]
                    }
                };

                usageManagementAPI.checkPermissions(req, function (err) {

                    expect(err).not.toBe(null);
                    expect(err.status).toBe(statusExpected);
                    expect(err.message).toBe(messageExpected);

                    done();
                });
            };

            it('should reject requests without "X-API-KEY" header', function (done) {
                testValidateApiKey({}, {}, 401, 'Missing header "X-API-KEY"', done);
            });

            it('should return 500 when db fails', function (done) {

                var accountingService = {
                    findOne: function (slect, callback) {
                        return callback('Error', {});
                    }
                };

                testValidateApiKey(accountingService, {'X-API-KEY': 'apiKey'}, 500, 'Error validating apiKey', done);
            });

            it('should reject request with not valid API Key', function (done) {
                var accountingService = {
                    findOne: function (slect, callback) {
                        return callback(null, null);
                    }
                };

                testValidateApiKey(accountingService, {'X-API-KEY': 'apiKey'}, 401, 'Invalid apikey', done);
            });

            it('should reject request with an uncommitted API Key', function (done) {
                var accountingService = {
                    findOne: function (slect, callback) {
                        return callback(null, {state: 'UNCOMMITTED'});
                    }
                };

                testValidateApiKey(accountingService, {'X-API-KEY': 'apiKey'}, 401, 'Apikey uncommitted', done);
            });

            it('should admit the request when the API Key is valid', function (done) {
                var accountingService = {
                    findOne: function (slect, callback) {
                        return callback(null, {state: 'COMMITTED'});
                    }
                };

                var usageManagementAPI = getUsageManagementAPI(accountingService, {}, {});
                var path = '/apiKey';

                var req = {
                    method: 'POST',
                    headers: {'X-API-KEY': 'apiKey'},
                    get: function (header) {
                        return this.headers[header]
                    }
                };

                usageManagementAPI.checkPermissions(req, function (err) {

                    expect(err).toBe(null);

                    done();
                });
            });

        });

        describe('Post Validation', function () {

            var testPostValidation = function (req, done) {

                var storeClient = jasmine.createSpyObj('storeClient', ['validateUsage']);
                storeClient.validateUsage.and.callFake( function (usageInfo, userInfo, callback) {
                    return callback(null);
                });

                var store = {
                    storeClient: storeClient
                };

                var usageManagementAPI = getUsageManagementAPI({}, store, {});

                usageManagementAPI.executePostValidation(req, function (err) {

                    expect(err).toBe(undefined);
                    expect(storeClient.validateUsage).not.toHaveBeenCalled();

                    done();
                });
            };

            it('should fail when the body is not a JSON', function (done) {

                var req = {
                    method: 'POST',
                    status: 201,
                    apiUrl: '/DSUsageManagement/api/usageManagement/v2/usage'
                };

                testPostValidation(req, done);
            });

            it('should not notify when the request is not a POST to ../usage', function (done) {

                var req = {
                    method: 'POST',
                    status: 201,
                    body: '{}',
                    apiUrl: '/DSUsageManagement/api/usageManagement/v2/usageSpecification'
                };

                testPostValidation(req, done);
            });

            it('should notify the Store if the usage management API notification is successful', function (done) {
                
                var storeClient = jasmine.createSpyObj('storeClient', ['validateUsage']);
                storeClient.validateUsage.and.callFake( function (usageInfo, userInfo, callback) {
                    return callback(null);
                });
                
                var store = {
                    storeClient: storeClient
                };

                var req = {
                    method: 'POST',
                    status: 201,
                    apiUrl: '/DSUsageManagement/api/usageManagement/v2/usage',
                    body: '{}'
                };

                var usageManagementAPI = getUsageManagementAPI({}, store, {});

                usageManagementAPI.executePostValidation(req, function (err) {

                    expect(err).toBe(null);
                    expect(storeClient.validateUsage.calls.argsFor(0)[0]).toEqual({});
                    expect(storeClient.validateUsage.calls.argsFor(0)[1]).toEqual(null);

                    done();
                });
            });
        });
    });
});