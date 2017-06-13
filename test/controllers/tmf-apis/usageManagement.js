/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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
    };

    describe('Check Permissions', function () {

        //////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////// NOT ALLOWED ////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        describe('Not allowed methods', function () {

            var methodNotAllowedStatus = 405;
            var methodNotAllowedMessage = 'This method used is not allowed in the accessed API';

            var testMethodNotAllowed = function (method, done) {

                var utils = jasmine.createSpyObj('utils', ['methodNotAllowed']);
                utils.methodNotAllowed.and.callFake(function (req, callback) {
                    return callback({
                        status: methodNotAllowedStatus,
                        message: methodNotAllowedMessage
                    });
                });

                var usageManagementAPI = getUsageManagementAPI({}, {}, utils, {});

                var path = '/apiKeys';

                var req = {
                    method: method,
                    url: path
                };

                usageManagementAPI.checkPermissions(req, function (err) {

                    expect(err).not.toBe(null);
                    expect(utils.methodNotAllowed).toHaveBeenCalled();
                    expect(err.status).toBe(methodNotAllowedStatus);
                    expect(err.message).toBe(methodNotAllowedMessage);

                    done();
                });
            };

            it('should reject PUT requests', function (done) {
                testMethodNotAllowed('PUT', done);
            });

            it('should reject PATCH requests', function (done) {
                testMethodNotAllowed('PATCH', done);
            });

            it('should reject DELETE requests', function (done) {
                testMethodNotAllowed('DELETE', done);
            });

        });

        //////////////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////// NOT AUTHENTICATED /////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////
        
        describe('Not Authenticated Requests', function () {

            it('should reject not authenticated GET requests', function (done) {

                var requestNotAuthenticatedStatus = 401;
                var requestNotAuthenticatedMessage = 'You need to be authenticated to create/update/delete resources';

                var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                utils.validateLoggedIn.and.callFake(function (req, callback) {
                    return callback({
                        status: requestNotAuthenticatedStatus,
                        message: requestNotAuthenticatedMessage
                    });
                });

                var tmfUtils = jasmine.createSpyObj('tmfUtils', ['filterRelatedPartyFields']);

                var usageManagementAPI = getUsageManagementAPI({}, {}, utils, tmfUtils);
                var path = '/apiKeys';

                var req = {
                    method: 'GET',
                    url: path
                };

                usageManagementAPI.checkPermissions(req, function (err) {

                    expect(err).not.toBe(null);
                    expect(utils.validateLoggedIn).toHaveBeenCalled();
                    expect(tmfUtils.filterRelatedPartyFields).not.toHaveBeenCalled();
                    expect(err.status).toBe(requestNotAuthenticatedStatus);
                    expect(err.message).toBe(requestNotAuthenticatedMessage);

                    done();
                });
            });
        });

        //////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////// RETRIEVAL //////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////
        
        describe('GET', function () {

            var testGetUsage = function (filterRelatedPartyFields, expectedErr, validator, query, done) {

                var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                utils.validateLoggedIn.and.callFake(function (req, callback) {
                    return callback();
                });

                var tmfUtils = jasmine.createSpyObj('tmfUtils', ['filterRelatedPartyFields']);
                tmfUtils.filterRelatedPartyFields.and.callFake(filterRelatedPartyFields);

                var storeClient = jasmine.createSpyObj('storeClient', ['refreshUsage']);
                storeClient.refreshUsage.and.callFake((o, p, cb) => {
                    cb(null);
                });

                var req = {
                    method: 'GET',
                    query: query
                };

                var usageManagementAPI = getUsageManagementAPI({}, {storeClient: storeClient}, utils, tmfUtils);

                usageManagementAPI.checkPermissions(req, function (err) {
                    expect(err).toBe(expectedErr);
                    expect(utils.validateLoggedIn).toHaveBeenCalled();
                    expect(tmfUtils.filterRelatedPartyFields).toHaveBeenCalled();

                    validator(storeClient);
                    done();
                });
            };

            it('should call callback without errors when user is allowed to retrieve the list of usages', function (done) {

                var filterRelatedPartyFields = function (req, callback) {
                    return callback();
                };

                testGetUsage(filterRelatedPartyFields, null, (storeClient) => {
                    expect(storeClient.refreshUsage).not.toHaveBeenCalled();
                }, null, done);
            });

            it('should call callback with error when retrieving list of usages and using invalid filters', function (done) {

                var error = {
                    status: 401,
                    message: 'Invalid filters'
                };

                var filterRelatedPartyFields = function (req, callback) {
                    return callback(error);
                };

                testGetUsage(filterRelatedPartyFields, error, (storeClient) => {
                    expect(storeClient.refreshUsage).not.toHaveBeenCalled();
                }, null, done);
            });

            it('should call refreshAccounting when the orderId and productId filter has been included', function (done) {
                var filterRelatedPartyFields = function (req, callback) {
                    return callback();
                };

                var query = {
                    'usageCharacteristic.orderId': '1',
                    'usageCharacteristic.productId': '2'
                };

                testGetUsage(filterRelatedPartyFields, null, (storeClient) => {
                    expect(storeClient.refreshUsage)
                        .toHaveBeenCalledWith(
                            query['usageCharacteristic.orderId'],
                            query['usageCharacteristic.productId'],
                            jasmine.any(Function));
                }, query, done);
            });

            it('should include productId filter when usageCharacteristic.value query string has been included', function (done) {
                var filterRelatedPartyFields = function (req, callback) {
                    return callback();
                };

                var query = {
                    'usageCharacteristic.value': '2'
                };

                testGetUsage(filterRelatedPartyFields, null, (storeClient) => {
                    expect(storeClient.refreshUsage).not.toHaveBeenCalled();
                    expect(query).toEqual({
                        'usageCharacteristic.productId': '2'
                    });
                }, query, done);
            });
        });

        //////////////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////// CREATION //////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////
        
        describe('Creation', function () {

            var testValidateApiKey = function (findOne, headers, expectedErr, done) {

                var accountingService = jasmine.createSpyObj('accountingService', ['findOne']);
                accountingService.findOne.and.callFake(findOne);

                var usageManagementAPI = getUsageManagementAPI(accountingService, {}, {}, {});

                var req = {
                    method: 'POST',
                    headers: headers,
                    get: function (header) {
                        return this.headers[header]
                    }
                };

                usageManagementAPI.checkPermissions(req, function (err) {

                    expect(err).toEqual(expectedErr);

                    if (typeof findOne === Function) {
                        expect(accountingService.findOne).toHaveBeenCalled();
                    }

                    done();
                });
            };

            it('should reject requests without "X-API-KEY" header', function (done) {

                testValidateApiKey(null, {}, {status: 401, message: 'Missing header "X-API-KEY"'}, done);
            });

            it('should return 500 when db fails', function (done) {

                var findOne = function (select, callback) {
                    return callback('Error', {});
                };

                testValidateApiKey(findOne, {'X-API-KEY': 'apiKey'}, {status: 500, message: 'Error validating apiKey'}, done);
            });

            it('should reject request with not valid API Key', function (done) {

                var findOne = function (select, callback) {
                    return callback(null, null);
                };

                testValidateApiKey(findOne, {'X-API-KEY': 'apiKey'}, {status: 401, message: 'Invalid apikey'}, done);
            });

            it('should reject request with an uncommitted API Key', function (done) {

                var findOne = function (select, callback) {
                    return callback(null, {state: 'UNCOMMITTED'});
                };

                testValidateApiKey(findOne, {'X-API-KEY': 'apiKey'}, {status: 401, message: 'Apikey uncommitted'}, done);
            });

            it('should admit the request when the API Key is valid', function (done) {

                var findOne = function (select, callback) {
                    return callback(null, {state: 'COMMITTED'});
                };

                testValidateApiKey(findOne, {'X-API-KEY': 'apiKey'}, null, done);
            });

        });

        describe('Post Validation', function () {
            var USAGE_URL = '/DSUsageManagement/api/usageManagement/v2/usage';

            var mockStoreClient = function() {
                var storeClient = jasmine.createSpyObj('storeClient', ['validateUsage']);
                storeClient.validateUsage.and.callFake(function (usageInfo, callback) {
                    return callback(null);
                });

                return storeClient;
            };

            describe('POST request', function() {

                var testPostValidation = function (apiUrl, shouldNotify, done) {

                    var storeClient = mockStoreClient();
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

                    testPostValidation(USAGE_URL, true, done);
                });

                it('should notify the Store if the usage management API notification is successful (path end with "/")', function (done) {

                    testPostValidation(USAGE_URL, true, done);
                });
            });
        });
    });
});