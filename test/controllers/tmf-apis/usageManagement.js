var proxyquire = require('proxyquire').noCallThru();

describe('Usage Management API', function () {

    var DEFAULT_USER_ID = 'userId';

    var getUsageManagementAPI = function (accountingService, storeClient, utils, tmfUtils) {
        return proxyquire('../../../controllers/tmf-apis/usageManagement', {
            './../../db/schemas/accountingService': accountingService,
            './../../lib/store': storeClient,
            './../../lib/utils': utils,
            './../../lib/tmfUtils': tmfUtils
        }).usageManagement;
    }

    describe('Check Permissions', function () {

        //////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////// NOT ALLOWED ////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        describe('Not allowed methods', function () {

            var methodNotAllowedStatus = 405;
            var methodNotAllowedMessage = 'This method used is not allowed in the accessed API';

            var testMethodNotAllowed = function (method, done) {

                var methodNotAllowed = function (req, callback) {
                    return callback ({
                        status: methodNotAllowedStatus,
                        message: methodNotAllowedMessage
                    });
                };

                var utils = {
                    methodNotAllowed: methodNotAllowed
                };

                var usageManagementAPI = getUsageManagementAPI({}, {}, utils, {});

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

            var testNotLoggedIn = function (method, done) {

                var validateLoggedError = function (req, callback) {
                    return callback({
                        status: requestNotAuthenticatedStatus,
                        message: requestNotAuthenticatedMessage
                    });
                };

                var utils = {
                    validateLoggedIn: validateLoggedError
                };

                var tmfUtils = {
                    filterRelatedPartyFields: function (req, callback) {
                        return callback();
                    }
                }

                var usageManagementAPI = getUsageManagementAPI({}, {}, utils, tmfUtils);
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

            var testRelatedParty = function (filterRelatedPartyFields, expectedErr, done) {

                var utils = {
                    validateLoggedIn: function (req, callback) {
                        return callback(); 
                    }
                };

                var tmfUtils = jasmine.createSpyObj('tmfUtils', ['filterRelatedPartyFields']);
                tmfUtils.filterRelatedPartyFields.and.callFake(filterRelatedPartyFields);

                var req = {
                    method: 'GET'
                };

                var usageManagementAPI = getUsageManagementAPI({}, {}, utils, tmfUtils);

                usageManagementAPI.checkPermissions(req, function (err) {
                    expect(err).toBe(expectedErr);
                    expect(tmfUtils.filterRelatedPartyFields).toHaveBeenCalled();
                    
                    done();
                });
            };

            it('should call callback without errors when user is allowed to retrieve the list of usages', function (done) {

                var filterRelatedPartyFields = function (req, callback) {
                    return callback();
                };

                testRelatedParty(filterRelatedPartyFields, null, done);
            });

            it('should call callback with error when retrieving list of usages and using invalid filters', function (done) {

                var error = {
                    status: 401,
                    message: 'Invalid filters'
                };

                var filterRelatedPartyFields = function (req, callback) {
                    return callback(error);
                };

                testRelatedParty(filterRelatedPartyFields, error, done);
            });
        });

        //////////////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////// CREATION //////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////
        
        describe('Creation', function () {

            var testValidateApiKey = function (accountingService, headers, expectedErr, done) {

                var usageManagementAPI = getUsageManagementAPI(accountingService, {}, {}, {});
                var path = '/apiKey';

                var req = {
                    method: 'POST',
                    headers: headers,
                    get: function (header) {
                        return this.headers[header]
                    }
                };

                usageManagementAPI.checkPermissions(req, function (err) {

                    expect(err).toEqual(expectedErr)

                    done();
                });
            };

            it('should reject requests without "X-API-KEY" header', function (done) {
                testValidateApiKey({}, {}, {status: 401, message: 'Missing header "X-API-KEY"'}, done);
            });

            it('should return 500 when db fails', function (done) {

                var accountingService = {
                    findOne: function (slect, callback) {
                        return callback('Error', {});
                    }
                };

                testValidateApiKey(accountingService, {'X-API-KEY': 'apiKey'}, {status: 500, message: 'Error validating apiKey'}, done);
            });

            it('should reject request with not valid API Key', function (done) {
                var accountingService = {
                    findOne: function (slect, callback) {
                        return callback(null, null);
                    }
                };

                testValidateApiKey(accountingService, {'X-API-KEY': 'apiKey'}, {status: 401, message: 'Invalid apikey'}, done);
            });

            it('should reject request with an uncommitted API Key', function (done) {
                var accountingService = {
                    findOne: function (slect, callback) {
                        return callback(null, {state: 'UNCOMMITTED'});
                    }
                };

                testValidateApiKey(accountingService, {'X-API-KEY': 'apiKey'}, {status: 401, message: 'Apikey uncommitted'}, done);
            });

            it('should admit the request when the API Key is valid', function (done) {
                var accountingService = {
                    findOne: function (slect, callback) {
                        return callback(null, {state: 'COMMITTED'});
                    }
                };

                testValidateApiKey(accountingService, {'X-API-KEY': 'apiKey'}, null, done);
            });

        });

        describe('Post Validation', function () {

            var testPostValidation = function (apiUrl, shouldNotify, done) {

                var storeClient = jasmine.createSpyObj('storeClient', ['validateUsage']);
                storeClient.validateUsage.and.callFake(function (usageInfo, callback) {
                    return callback(null);
                });

                var store = {
                    storeClient: storeClient
                };

                var req = {
                    method: 'POST',
                    status: 201,
                    body: '{}',
                    apiUrl: apiUrl
                };

                var usageManagementAPI = getUsageManagementAPI({}, store, {}, {});

                usageManagementAPI.executePostValidation(req, function (err) {

                    expect(err).toBe(null);

                    if (shouldNotify) {
                        expect(storeClient.validateUsage).toHaveBeenCalled();
                    } else {
                        expect(storeClient.validateUsage).not.toHaveBeenCalled();
                    }

                    done();
                });
            };

            it('should not notify when the request is not a POST to ../usage', function (done) {

                testPostValidation('/DSUsageManagement/api/usageManagement/v2/usageSpecification', false, done);
            });

            it('should notify the Store if the usage management API notification is successful', function (done) {
                
                testPostValidation('/DSUsageManagement/api/usageManagement/v2/usage', true, done);
            });
        });
    });
});