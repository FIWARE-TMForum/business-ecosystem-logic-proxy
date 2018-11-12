/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
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

var nock = require('nock'),
    proxyquire =  require('proxyquire'),
    testUtils = require('../../utils');

describe('Customer API', function() {

    var config = testUtils.getDefaultConfig();
    var BILLING_SERVER = (config.endpoints.billing.appSsl ? 'https' : 'http') + '://' + config.endpoints.billing.host + ':' + config.endpoints.billing.port;
    var CUSTOMER_SERVER = (config.endpoints.customer.appSsl ? 'https' : 'http') + '://' + config.endpoints.customer.host + ':' + config.endpoints.customer.port;

    var BASE_BILLING_PATH = '/' + config.endpoints.billing.path + '/api/billingManagement/v2/billingAccount';
    var VALID_CUSTOMER_PATH = '/' + config.endpoints.customer.path + '/api/customerManagement/v2/customer';
    var VALID_CUSTOMER_ACCOUNT_PATH = '/' + config.endpoints.customer.path + '/api/customerManagement/v2/customerAccount';

    var CUSTOMER_CANNOT_BE_RETRIEVED_ERROR = {
        status: 500,
        message: 'The attached customer cannot be retrieved'
    };

    var UNAUTHORIZED_UPDATE_RESOURCE_ERROR = {
            status: 403,
            message: 'Unauthorized to update/delete non-owned resources'
    };

    var UNAUTHORIZED_RETRIEVE_CUSTOMER_ERROR = {
        status: 403,
        message: 'Unauthorized to retrieve the information of the given customer'
    };

    var BILLING_ACCOUNT_CANNOT_BE_RETRIEVED_ERROR = {
        status: 500,
        message: 'An error arises at the time of retrieving associated billing accounts'
    };

    var getCustomerAPI = function(utils, tmfUtils) {
        return proxyquire('../../../controllers/tmf-apis/customer', {
            './../../config': config,
            './../../lib/tmfUtils': tmfUtils,
            './../../lib/utils': utils
        }).customer;
    };

    beforeEach(function() {
        nock.cleanAll();
    });

    describe('Check Permissions', function() {

        // Generic test for GET, POST, PATCH, DELETE

        var failIfNotLoggedIn = function (method, done) {

            var returnedError = {
                status: 401,
                message: 'User not logged in'
            };

            var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
            utils.validateLoggedIn.and.callFake(function (req, callback) {
                callback(returnedError);
            });

            var customerApi = getCustomerAPI(utils, {});
            var req = {
                method: method,
                apiUrl: VALID_CUSTOMER_PATH,
                body: {}
            };

            customerApi.checkPermissions(req, function (err) {
                expect(err).toBe(returnedError);
                done();
            });
        };

        describe('General', function () {

            it('should reject requests to not supported paths', function (done) {

                var customerApi = getCustomerAPI({}, {});
                var req = {
                    method: 'GET',
                    apiUrl: '/' + config.endpoints.customer.path + '/api/customerManagement/v2/hub'
                };

                customerApi.checkPermissions(req, function (err) {

                    expect(err).toEqual({
                        status: 403,
                        message: 'This API feature is not supported yet'
                    });

                    done();
                });
            });

            it('should reject requests with unrecognized methods', function (done) {
                var customerApi = getCustomerAPI({}, {});
                var req = {
                    method: 'PUT',
                    apiUrl: VALID_CUSTOMER_PATH
                };

                customerApi.checkPermissions(req, function (err) {

                    expect(err).toEqual({
                        status: 405,
                        message: 'Method not allowed'
                    });

                    done();
                });
            });

            it('should reject requests with invalid body', function (done) {
                var customerApi = getCustomerAPI({}, {});
                var req = {
                    method: 'POST',
                    apiUrl: VALID_CUSTOMER_PATH,
                    body: 'invalid'
                };

                customerApi.checkPermissions(req, function (err) {

                    expect(err).toEqual({
                        status: 400,
                        message: 'Invalid body'
                    });

                    done();
                });
            });
        });

        describe('GET', function () {

            it('should not allow to retrieve resources if user is not logged in', function (done) {
                failIfNotLoggedIn('GET', done);
            });

            var testListCustomerAccount = function (path, done) {

                var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                utils.validateLoggedIn.and.callFake(function (req, callback) {
                    callback(null);
                });

                var customerApi = getCustomerAPI(utils, {});
                var req = {
                    method: 'GET',
                    apiUrl: path,
                    body: {}
                };

                customerApi.checkPermissions(req, function (err) {
                    expect(err).toEqual({
                        status: 403,
                        message: 'Unauthorized to retrieve the list of customer accounts'
                    });
                    done();
                });
            };

            it('should not allow to list customer accounts', function (done) {
                testListCustomerAccount(VALID_CUSTOMER_ACCOUNT_PATH, done);
            });

            it('should not allow to list customer accounts even if query included', function (done) {
                testListCustomerAccount(VALID_CUSTOMER_ACCOUNT_PATH + '/?a=b', done);
            });

            var testListCustomer = function (expectedErr, done) {

                var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                utils.validateLoggedIn.and.callFake(function (req, callback) {
                    callback(null);
                });

                var tmfUtils = jasmine.createSpyObj('tmfUtils', ['filterRelatedPartyFields']);
                tmfUtils.filterRelatedPartyFields.and.callFake(function (req, callback) {
                    callback(expectedErr);
                });

                var customerApi = getCustomerAPI(utils, tmfUtils);
                var req = {
                    method: 'GET',
                    apiUrl: VALID_CUSTOMER_PATH,
                    body: {}
                };

                customerApi.checkPermissions(req, function (err) {
                    expect(err).toBe(expectedErr);
                    done();
                });
            };

            it('should not allow to list customers when invalid filters applied', function (done) {
                testListCustomer({status: 403, message: 'Invalid filter'}, done);
            });

            it('should allow to list customers when valid filters applied', function (done) {
                testListCustomer(null, done);
            });

            var testGetResource = function (path, done) {

                var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                utils.validateLoggedIn.and.callFake(function (req, callback) {
                    callback(null);
                });

                var customerApi = getCustomerAPI(utils, {});
                var req = {
                    method: 'GET',
                    apiUrl: path,
                    body: {}
                };

                customerApi.checkPermissions(req, function (err) {
                    expect(err).toBe(null);
                    done();
                });
            };

            it('should allow to retrieve one customer', function (done) {
                testGetResource(VALID_CUSTOMER_PATH + '/1', done);
            });

            it('should allow to retrieve one customer account', function (done) {
                testGetResource(VALID_CUSTOMER_ACCOUNT_PATH + '/1', done);
            });

        });

        describe('POST', function () {

            it('should not allow to create resource if the user is not logged in', function (done) {
                failIfNotLoggedIn('POST', done);
            });

            var testCreate = function (path, body, hasPartyRole, expectedPartyCall, expectedErr, done) {

                var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                utils.validateLoggedIn.and.callFake(function (req, callback) {
                    callback(null);
                });

                var tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole']);
                tmfUtils.hasPartyRole.and.returnValue(hasPartyRole);

                var customerApi = getCustomerAPI(utils, tmfUtils);
                var req = {
                    method: 'POST',
                    apiUrl: path,
                    body: JSON.stringify(body)
                };

                customerApi.checkPermissions(req, function (err) {

                    expect(err).toEqual(expectedErr);

                    if (expectedPartyCall) {
                        expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, expectedPartyCall, 'owner');
                    }

                    done();
                });

            };

            it('should not allow to create customer without related party', function (done) {

                var expectedErr = {
                    status: 422,
                    message: 'Unable to create customer without specifying the related party'
                };

                testCreate(VALID_CUSTOMER_PATH, {}, false, null, expectedErr, done);

            });

            it('should not allow to create a customer with invalid related party', function (done) {

                var expectedErr = {
                    status: 403,
                    message: 'Related Party does not match with the user making the request'
                };

                var body = {
                    relatedParty: {
                        id: 7
                    }
                };

                testCreate(VALID_CUSTOMER_PATH, body, false, [body.relatedParty], expectedErr, done);
            });

            it('should allow to create customer with valid related party', function (done) {

                var body = {
                    relatedParty: {
                        id: 7
                    }
                };

                testCreate(VALID_CUSTOMER_PATH, body, true, [body.relatedParty], null, done);
            });

            it('should not allow to create a customer with the customerAccount field', function (done) {

                var expectedErr = {
                    status: 403,
                    message: 'Customer Account cannot be manually modified'
                };

                var body = {
                    relatedParty: {
                        id: 7
                    },
                    customerAccount: []
                };

                testCreate(VALID_CUSTOMER_PATH, body, true, [body.relatedParty], expectedErr, done);
            });

            it('should not allow to create a customer account without customer field', function (done) {

                var expectedErr = {
                    status: 422,
                    message: 'Customer Accounts must be associated to a Customer'
                };

                testCreate(VALID_CUSTOMER_ACCOUNT_PATH, {}, false, null, expectedErr, done);
            });

            it('should not allow to create a customer account with invalid customer', function (done) {

                var body = {
                    customer: {
                        id: 7,
                        href: CUSTOMER_SERVER + VALID_CUSTOMER_PATH + '/8'
                    }
                };

                var expectedErr = {
                    status: 422,
                    message: 'Customer ID and Customer HREF mismatch'
                };

                testCreate(VALID_CUSTOMER_ACCOUNT_PATH, body, false, null, expectedErr, done);
            });

            it('should not allow to create a customer account when customer cannot be retrieved', function (done) {

                var customerPath = VALID_CUSTOMER_PATH + '/8';

                var body = {
                    customer: {
                        id: 8,
                        href: CUSTOMER_SERVER + customerPath
                    }
                };

                nock(CUSTOMER_SERVER)
                    .get(customerPath)
                    .reply(500);

                testCreate(VALID_CUSTOMER_ACCOUNT_PATH, body, false, null, CUSTOMER_CANNOT_BE_RETRIEVED_ERROR, done);

            });

            var testCreateAccountExistingCustomer = function (hasPartyRole, expectedErr, done) {

                var customerPath = VALID_CUSTOMER_PATH + '/8';

                var body = {
                    customer: {
                        id: 8,
                        href: CUSTOMER_SERVER + customerPath
                    }
                };

                var customer = {
                    relatedParty: {
                        id: 9
                    }
                };

                nock(CUSTOMER_SERVER)
                    .get(customerPath)
                    .reply(200, customer);

                testCreate(VALID_CUSTOMER_ACCOUNT_PATH, body, hasPartyRole, [customer.relatedParty], expectedErr, done);
            };

            it('should not allow to create a customer account when given customer does not belong to the user', function (done) {

                var expectedErr = {
                    status: 403,
                    message: 'The given Customer does not belong to the user making the request'
                };

                testCreateAccountExistingCustomer(false, expectedErr, done);

            });

            it('should allow to create customer account', function (done) {
                testCreateAccountExistingCustomer(true, null, done);
            });

        });

        // GENERIC TESTS FOR PATCH & DELETE

        var testUpdateDelete = function (path, method, body, hasPartyRole, expectedPartyCall, expectedErr, done) {

            var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
            utils.validateLoggedIn.and.callFake(function (req, callback) {
                callback(null);
            });

            var tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole']);
            tmfUtils.hasPartyRole.and.returnValue(hasPartyRole);

            var customerApi = getCustomerAPI(utils, tmfUtils);
            var req = {
                method: method,
                apiUrl: path,
                body: JSON.stringify(body)
            };

            customerApi.checkPermissions(req, function (err) {
                expect(err).toEqual(expectedErr);

                if (expectedPartyCall) {
                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, expectedPartyCall, 'owner');
                }

                done();
            });
        };

        var failUpdateResourceCannotBeRetrieved = function(method, done) {

            // This test is valid for customer and customer accounts
            var customerPath = VALID_CUSTOMER_PATH + '/8';

            nock(CUSTOMER_SERVER)
                .get(customerPath)
                .reply(500);

            var expectedErr = {
                status: 500,
                message: 'The required resource cannot be retrieved'
            };

            testUpdateDelete(customerPath, method, {}, false, null, expectedErr, done);
        };

        var failUpdateResourceDoesNotExist = function(method, done) {
            // This test is valid for customer and customer accounts
            var customerPath = VALID_CUSTOMER_PATH + '/8';

            nock(CUSTOMER_SERVER)
                .get(customerPath)
                .reply(404);

            var expectedErr = {
                status: 404,
                message: 'The required resource does not exist'
            };

            testUpdateDelete(customerPath, method, {}, false, null, expectedErr, done);
        };

        var failUpdateNonOwnedResource = function(method, done) {
            testUpdateDeleteCustomer('PATCH', {}, false, UNAUTHORIZED_UPDATE_RESOURCE_ERROR, done);
        };

        var testUpdateDeleteCustomer = function (method, body, hasPartyRole, expectedErr, done) {

            var customerPath = VALID_CUSTOMER_PATH + '/8';

            var customer = {
                relatedParty: {
                    id: 9
                }
            };

            nock(CUSTOMER_SERVER)
                .get(customerPath)
                .reply(200, customer);

            testUpdateDelete(customerPath, method, body, hasPartyRole, [customer.relatedParty], expectedErr, done);
        };

        var failUpdateCustomerAccountCustomerInaccessible = function(method, done) {

            var customerAccountPath = VALID_CUSTOMER_ACCOUNT_PATH + '/9';
            var customerPath = VALID_CUSTOMER_PATH + '/8';

            var customerAccount = {
                customer: {
                    id: 8,
                    href: CUSTOMER_SERVER + customerPath
                }
            };

            nock(CUSTOMER_SERVER)
                .get(customerAccountPath)
                .reply(200, customerAccount);

            nock(CUSTOMER_SERVER)
                .get(customerPath)
                .reply(500);

            testUpdateDelete(customerAccountPath, method, {}, false, null, CUSTOMER_CANNOT_BE_RETRIEVED_ERROR, done);
        };

        var testUpdateCustomerAccountExistingCustomer = function (method, body, hasPartyRole, expectedErr, done) {

            var customerAccountPath = VALID_CUSTOMER_ACCOUNT_PATH + '/9';
            var customerPath = VALID_CUSTOMER_PATH + '/8';

            var customerAccount = {
                customer: {
                    id: 8,
                    href: CUSTOMER_SERVER + customerPath
                }
            };

            var customer = {
                relatedParty: {
                    id: 9
                }
            };

            nock(CUSTOMER_SERVER)
                .get(customerAccountPath)
                .reply(200, customerAccount);

            nock(CUSTOMER_SERVER)
                .get(customerPath)
                .reply(200, customer);

            testUpdateDelete(customerAccountPath, method, body, hasPartyRole, [customer.relatedParty], expectedErr, done);
        };

        var failUpdateCustomerAccountNonOwnedByUser = function(method, done) {
            testUpdateCustomerAccountExistingCustomer(method, {}, false, UNAUTHORIZED_UPDATE_RESOURCE_ERROR, done);
        };

        describe('PATCH', function () {

            it('should not allow to update a resource if the user is not logged in', function (done) {
                failIfNotLoggedIn('PATCH', done);
            });

            it('should not allow to update a customer (account)? when it cannot be retrieved', function (done) {
                failUpdateResourceCannotBeRetrieved('PATCH', done)
            });

            it('should not allow to update a customer (account)? that does not exist', function (done) {
                failUpdateResourceDoesNotExist('PATCH', done);
            });

            it('should not allow to update a non-owned customer', function (done) {
                failUpdateNonOwnedResource('PATCH', done);
            });

            it('should not allow to update the relatedParty field of a customer', function (done) {
                var expectedErr = {
                    status: 403,
                    message: 'Related Party cannot be modified'
                };

                testUpdateDeleteCustomer('PATCH', {relatedParty: {}}, true, expectedErr, done);
            });

            it('should allow to update a customer', function (done) {
                testUpdateDeleteCustomer('PATCH', {}, true, null, done);
            });

            it('should not allow to update a customer account when the attached customer cannot be retrieved', function (done) {
                failUpdateCustomerAccountCustomerInaccessible('PATCH', done);
            });

            it('should not allow to update a customer account when the attached customer does not belong to the user', function (done) {
                failUpdateCustomerAccountNonOwnedByUser('PATCH', done);
            });

            it('should allow to update a customer account', function (done) {
                testUpdateCustomerAccountExistingCustomer('PATCH', {}, true, null, done);
            });

            it('should not allow to update the customer field of a customer account', function (done) {

                var expectedErr = {
                    status: 403,
                    message: 'Customer cannot be modified'
                };

                testUpdateCustomerAccountExistingCustomer('PATCH', {customer: {}}, true, expectedErr, done);
            });

        });

        describe('DELETE', function () {

            it('should not allow to delete a resource if the user is not logged in', function (done) {
                failIfNotLoggedIn('DELETE', done);
            });

            it('should not allow to delete a customer (account)? and it cannot be retrieved', function (done) {
                failUpdateResourceCannotBeRetrieved('DELETE', done)
            });

            it('should not allow to delete a customer (account)? that does not exist', function (done) {
                failUpdateResourceDoesNotExist('DELETE', done);
            });

            it('should not allow to delete a non-owned customer', function (done) {
                failUpdateNonOwnedResource('DELETE', done);
            });

            it('should allow to delete a customer', function (done) {
                testUpdateDeleteCustomer('DELETE', {}, true, null, done);
            });

            it('should not allow to delete a customer account when the attached customer cannot be retrieved', function (done) {
                failUpdateCustomerAccountCustomerInaccessible('DELETE', done);
            });

            it('should not allow to delete a customer account when the attached customer does not belong to the user', function (done) {
                failUpdateCustomerAccountNonOwnedByUser('PATCH', done);
            });

            it('should allow to delete a customer account', function (done) {
                testUpdateCustomerAccountExistingCustomer('DELETE', {}, true, null, done);
            });

        });
    });

    describe('Post Validation', function() {

        describe('GET', function() {

            it('should allow to retrieve collections', function(done) {

                var req = {
                    method: 'GET',
                    body: JSON.stringify([])
                };

                var customerApi = getCustomerAPI({}, {});

                customerApi.executePostValidation(req, function(err) {
                    expect(err).toBe(null);
                    done();
                });
            });

            var testRetrieveResource = function(body, hasPartyRole, isRelatedPartyValues, hasPartyRoleArgument,
                                                isRelatedPartyArguments, expectedErr, done) {

                var req = {
                    method: 'GET',
                    body: JSON.stringify(body)
                };

                var tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole', 'isRelatedParty']);
                tmfUtils.hasPartyRole.and.returnValue(hasPartyRole);
                tmfUtils.isRelatedParty.and.returnValues.apply(tmfUtils.isRelatedParty, isRelatedPartyValues);

                var customerApi = getCustomerAPI({}, tmfUtils);

                customerApi.executePostValidation(req, function(err) {
                    expect(err).toEqual(expectedErr);

                    if (hasPartyRoleArgument) {
                        expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, hasPartyRoleArgument, 'owner');
                    }

                    if (isRelatedPartyArguments) {
                        isRelatedPartyArguments.forEach(function (item) {
                            expect(tmfUtils.isRelatedParty).toHaveBeenCalledWith(req, item);
                        });
                    }

                    done();
                });
            };

            it('should allow to retrieve an owned customer', function(done) {

                var body = {
                    relatedParty: {
                        id: 9
                    }
                };

                testRetrieveResource(body, true, null, [body.relatedParty], null, null, done);
            });

            var testRetrieveCustomerAccount = function(customerResponse, billingResponse, hasPartyRole,
                                                       isRelatedPartyValues, hasPartyRoleArgument,
                                                       isRelatedPartyArguments, expectedErr, done) {

                var customerPath = '/customer/1';

                var customerAccount = {
                    id: 7,
                    customer: {
                        href: CUSTOMER_SERVER + customerPath
                    }
                };

                var customer = {
                    relatedParty: {
                        id: 3
                    }
                };

                nock(CUSTOMER_SERVER)
                    .get(customerPath)
                    .reply(customerResponse.status, customerResponse.body);

                if (billingResponse) {
                    nock(BILLING_SERVER)
                        .get(BASE_BILLING_PATH + '?customerAccount.id=' + customerAccount.id)
                        .reply(billingResponse.status, billingResponse.body);
                }

                testRetrieveResource(customerAccount, hasPartyRole, isRelatedPartyValues, hasPartyRoleArgument,
                    isRelatedPartyArguments, expectedErr, done);

            };

            it('should allow to retrieve an owned customer account', function(done) {

                var customer = {
                    relatedParty: {
                        id: 3
                    }
                };

                testRetrieveCustomerAccount({status: 200, body: customer}, null, true, null,
                    [customer.relatedParty], null, null, done);

            });

            it('should not allow to retrieve a customer account when customer cannot be retrieved', function(done) {

                var expectedErr = {
                    status: 500,
                    message: 'The attached customer cannot be retrieved'
                };

                testRetrieveCustomerAccount({status: 500, body: null}, null, true, null, null, null, expectedErr, done);
            });

            it('should not allow to retrieve a non-owned customer account when user not included in billing account', function(done) {

                var customer = {
                    relatedParty: {
                        id: 3
                    }
                };

                var billingAccount = {
                    relatedParty: [
                        {
                            id: 5
                        }
                    ]
                };

                testRetrieveCustomerAccount({status: 200, body: customer}, {status: 200, body: [billingAccount]},
                    false, [false], [customer.relatedParty], [billingAccount.relatedParty],
                    UNAUTHORIZED_RETRIEVE_CUSTOMER_ERROR, done);

            });

            it('should not allow to retrieve a non-owned customer account when billing account cannot be retrieved', function(done) {

                var customer = {
                    relatedParty: {
                        id: 3
                    }
                };

                testRetrieveCustomerAccount({status: 200, body: customer}, {status: 500, body: null},
                    false, null, [customer.relatedParty], null,
                    BILLING_ACCOUNT_CANNOT_BE_RETRIEVED_ERROR, done);

            });

            it('should allow to retrieve a non-owned customer account if included in billing account', function(done) {

                var customer = {
                    relatedParty: {
                        id: 3
                    }
                };

                var billingAccount = {
                    relatedParty: [
                        {
                            id: 5
                        }
                    ]
                };

                testRetrieveCustomerAccount({status: 200, body: customer}, {status: 200, body: [billingAccount]},
                    false, [true], [customer.relatedParty], [billingAccount.relatedParty],
                    null, done);

            });

            var testBillingAccountRetrieved = function(response, isRelatedPartyValues,
                                                       isRelatedPartyArguments, expectedErr, done) {

                var customer = {
                    relatedParty: {
                        id: 9
                    },
                    customerAccount: [
                        {
                            id: 1
                        },
                        {
                            id: 2
                        }
                    ]
                };

                nock(BILLING_SERVER)
                    .get(BASE_BILLING_PATH + '?customerAccount.id=1,2')
                    .reply(response.status, response.body);

                testRetrieveResource(customer, false, isRelatedPartyValues,
                    [customer.relatedParty], isRelatedPartyArguments, expectedErr, done);
            };

            it('should not allow to retrieve customer it it does not belong to the user and ' +
                    'billing account cannot be retrieved', function(done) {

                testBillingAccountRetrieved({status: 500, body: null}, null, null,
                    BILLING_ACCOUNT_CANNOT_BE_RETRIEVED_ERROR, done);

            });

            it('should not allow to retrieve customer if it does not belong to the user and ' +
                    '(s)he is not included in the billing account', function(done) {

                var billingAccount = {
                    relatedParty: [
                        {
                            id: 5
                        }
                    ]
                };

                testBillingAccountRetrieved({status: 200, body: [billingAccount]}, [false],
                    [billingAccount.relatedParty], UNAUTHORIZED_RETRIEVE_CUSTOMER_ERROR, done);

            });

            it('should not allow to retrieve customer if it does not belong to the user and ' +
                'no billing accounts received', function(done) {

                testBillingAccountRetrieved({status: 200, body: []}, [false],
                    null, UNAUTHORIZED_RETRIEVE_CUSTOMER_ERROR, done);

            });

            it('should allow to retrieve customer if user is included in billing account', function(done) {

                var billingAccount1 = {
                    relatedParty: [
                        {
                            id: 5
                        }
                    ]
                };

                var billingAccount2 = {
                    relatedParty: [
                        {
                            id: 9
                        }
                    ]
                };

                testBillingAccountRetrieved({status: 200, body: [billingAccount1, billingAccount2]}, [false, true],
                    [billingAccount1.relatedParty, billingAccount2.relatedParty], null, done);

            });

        });

        describe('POST', function() {

            it('should not fail if the request does not contain a customer field', function(done) {

                var req = {
                    method: 'POST',
                    body: JSON.stringify({})
                };

                var customerApi = getCustomerAPI({}, {});

                customerApi.executePostValidation(req, function(err) {
                    expect(err).toBe(null);
                    done();
                });
            });

            it('should log a message if creating a customer account and the associated customer cannot be retrieved', function(done) {

                var customerPath = '/customer/3';

                var body = {
                    customer: {
                        href: CUSTOMER_SERVER + customerPath
                    }
                };

                nock(CUSTOMER_SERVER)
                    .get(customerPath)
                    .reply(500);

                var req = {
                    method: 'POST',
                    body: JSON.stringify(body)
                };

                var utils = jasmine.createSpyObj('utils', ['log']);

                var customerApi = getCustomerAPI(utils, {});

                customerApi.executePostValidation(req, function(err) {
                    expect(err).toBe(null);
                    expect(utils.log).toHaveBeenCalledWith(jasmine.any(Object), 'warn', req,
                        'Impossible to load attached Customer');
                    done();
                });

            });

            var testUpdateCustomerAccount = function(responseStatus, done) {

                var customerPath = '/customer/3';

                var customerAccount = {
                    id: 7,
                    href: CUSTOMER_SERVER + '/customerAccount/7',
                    name: 'customer',
                    customer: {
                        href: CUSTOMER_SERVER + customerPath
                    }
                };

                var customer = {
                    customerAccount: [
                        {
                            id: 9
                        }
                    ]
                };

                var expectedCustomerAccountField = JSON.parse(JSON.stringify(customer.customerAccount));
                expectedCustomerAccountField.push({
                    id: customerAccount.id,
                    href: customerAccount.href,
                    name: customerAccount.name,
                    status: 'Active'
                });

                nock(CUSTOMER_SERVER)
                    .get(customerPath)
                    .reply(200, customer);

                nock(CUSTOMER_SERVER)
                    .patch(customerPath, {customerAccount: expectedCustomerAccountField})
                    .reply(responseStatus);

                var req = {
                    method: 'POST',
                    body: JSON.stringify(customerAccount)
                };

                var utils = jasmine.createSpyObj('utils', ['log']);

                var customerApi = getCustomerAPI(utils, {});

                customerApi.executePostValidation(req, function(err) {
                    expect(err).toBe(null);

                    if (responseStatus != 200) {
                        expect(utils.log).toHaveBeenCalledWith(jasmine.any(Object), 'warn', req,
                            'Impossible to update the list of customer accounts: ' + responseStatus);
                    } else {
                        expect(utils.log).not.toHaveBeenCalled();
                    }

                    done();
                });
            };

            it('should log a message if creating a customer account and the customer cannot be updated', function(done) {
                testUpdateCustomerAccount(425, done);
            });

            it('should not log a message if creating a customer account and it can be updated', function(done) {
                testUpdateCustomerAccount(200, done);
            });
        });
    });

});