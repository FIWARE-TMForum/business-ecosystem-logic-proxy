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

var nock = require('nock');

var proxyquire = require('proxyquire');

var testUtils = require('../../utils');

describe('Billing API', function() {
    var config = testUtils.getDefaultConfig();
    var BILLING_SERVER =
        (config.endpoints.billing.appSsl ? 'https' : 'http') +
        '://' +
        config.endpoints.billing.host +
        ':' +
        config.endpoints.billing.port;
    var CUSTOMER_SERVER =
        (config.endpoints.customer.appSsl ? 'https' : 'http') +
        '://' +
        config.endpoints.customer.host +
        ':' +
        config.endpoints.customer.port;
    var PRODUCT_SERVER =
        (config.endpoints.inventory.appSsl ? 'https' : 'http') +
        '://' +
        config.endpoints.inventory.host +
        ':' +
        config.endpoints.inventory.port;

    var VALID_BILLING_PATH = '/' + config.endpoints.billing.path + '/api/billingManagement/v2/billingAccount';
    var VALID_CHARGES_PATH =
        '/' + config.endpoints.billing.path + '/api/billingManagement/v2/appliedCustomerBillingCharge';

    var UNSUPPORTED_FIELDS_ERROR = {
        status: 422,
        message: 'One or more of the included fields are not supported yet'
    };

    var INVALID_RELATED_PARTY_ERROR = {
        status: 403,
        message: 'The user making the request and the specified owner are not the same user'
    };

    var CUSTOMER_ACCOUNT_MISSING_ERROR = {
        status: 422,
        message: 'customerAccount field is mandatory'
    };

    var CUSTOMER_ACCOUNT_INACCESSIBLE_ERROR = {
        status: 422,
        message: 'The given customer account cannot be retrieved'
    };

    var CUSTOMER_INACCESSIBLE_ERROR = {
        status: 422,
        message: 'The customer attached to the customer account given cannot be retrieved'
    };

    var INVALID_CUSTOMER_ERROR = {
        status: 403,
        message: 'The given customer account does not belong to the user making the request'
    };

    var BILLING_INACCESSIBLE_ERROR = {
        status: 500,
        message: 'The given billing account cannot be accessed'
    };

    var BILLING_DOES_NOT_EXIST_ERROR = {
        status: 404,
        message: 'The given billing account does not exist'
    };

    var NON_OWNED_BILLING_ERROR = {
        status: 403,
        message: 'You are not authorized to update this billing account'
    };

    var RETRIEVAL_UNAUTHORIZED_ERROR = {
        status: 403,
        message: 'Unauthorized to retrieve the specified billing account'
    };

    var MISSING_PRODUCT_ID_ERROR = {
        status: 422,
        message: 'Please specify a concrete product id using the query string serviceId.id'
    };

    var PRODUCT_INACCESSIBLE_ERROR = {
        status: 422,
        message: 'It has not been possible to validate The specified product id'
    };

    var CHARGES_RETRIEVAL_UNAUTHORIZED = {
        status: 403,
        message: 'You are not authorized to retrieve charges related to the specified product id'
    };

    var getBillingAPI = function(utils, tmfUtils) {
        return proxyquire('../../../controllers/tmf-apis/billing', {
            './../../config': config,
            './../../lib/tmfUtils': tmfUtils,
            './../../lib/utils': utils
        }).billing;
    };

    beforeEach(function() {
        nock.cleanAll();
    });

    describe('Check Permissions', function() {
        var failIfNotLoggedIn = function(method, done) {
            var returnedError = {
                status: 401,
                message: 'User not logged in'
            };

            var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
            utils.validateLoggedIn.and.callFake(function(req, callback) {
                callback(returnedError);
            });

            var billingApi = getBillingAPI(utils, {});
            var req = {
                method: method,
                apiUrl: VALID_BILLING_PATH,
                body: {}
            };

            billingApi.checkPermissions(req, function(err) {
                expect(err).toBe(returnedError);
                done();
            });
        };

        describe('General', function() {
            it('should reject requests to other paths different from billing account', function(done) {
                var billingApi = getBillingAPI({}, {});
                var req = {
                    method: 'GET',
                    apiUrl: '/' + config.endpoints.billing.path + '/api/billingManagement/v2/hub'
                };

                billingApi.checkPermissions(req, function(err) {
                    expect(err).toEqual({
                        status: 403,
                        message: 'This API feature is not supported yet'
                    });

                    done();
                });
            });

            it('should reject requests with unrecognized methods', function(done) {
                var billingApi = getBillingAPI({}, {});
                var req = {
                    method: 'PUT',
                    apiUrl: VALID_BILLING_PATH
                };

                billingApi.checkPermissions(req, function(err) {
                    expect(err).toEqual({
                        status: 405,
                        message: 'Method not allowed'
                    });

                    done();
                });
            });

            it('should reject requests with invalid body', function(done) {
                var billingApi = getBillingAPI({}, {});
                var req = {
                    method: 'POST',
                    apiUrl: VALID_BILLING_PATH,
                    body: 'invalid'
                };

                billingApi.checkPermissions(req, function(err) {
                    expect(err).toEqual({
                        status: 400,
                        message: 'Invalid body'
                    });

                    done();
                });
            });
        });

        describe('Billing accounts', function() {
            describe('GET', function() {
                it('should not allow to retrieve resources if the user is not logged in', function(done) {
                    failIfNotLoggedIn('GET', done);
                });

                var testListBillingAccount = function(expectedErr, query, done) {
                    var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                    utils.validateLoggedIn.and.callFake(function(req, callback) {
                        callback(null);
                    });

                    var tmfUtils = jasmine.createSpyObj('tmfUtils', ['filterRelatedPartyFields']);
                    tmfUtils.filterRelatedPartyFields.and.callFake(function(req, callback) {
                        callback(expectedErr);
                    });

                    var billingApi = getBillingAPI(utils, tmfUtils);
                    var req = {
                        method: 'GET',
                        apiUrl: VALID_BILLING_PATH + query,
                        body: {}
                    };

                    billingApi.checkPermissions(req, function(err) {
                        expect(err).toBe(expectedErr);
                        done();
                    });
                };

                it('should not allow to retrieve a resource when user is trying to list but invalid relatedParty filter', function(done) {
                    var returnedError = {
                        status: 403,
                        message: 'Invalid Related Party'
                    };

                    testListBillingAccount(returnedError, '', done);
                });

                it(
                    'should not allow to retrieve a resource when user is trying to list but invalid relatedParty filter ' +
                        'even if query included',
                    function(done) {
                        var returnedError = {
                            status: 403,
                            message: 'Invalid Related Party'
                        };

                        testListBillingAccount(returnedError, '?a=b', done);
                    }
                );

                it('should allow to retrieve resource if user is trying to list and related party filter is valid', function(done) {
                    testListBillingAccount(null, '', done);
                });

                it('should allow to request a single billing account', function(done) {
                    // Please note, this is done in the post validation...
                    var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                    utils.validateLoggedIn.and.callFake(function(req, callback) {
                        callback(null);
                    });

                    var billingApi = getBillingAPI(utils, {});
                    var req = {
                        method: 'GET',
                        apiUrl: VALID_BILLING_PATH + '/1',
                        body: {}
                    };

                    billingApi.checkPermissions(req, function(err) {
                        expect(err).toBe(null);
                        done();
                    });
                });
            });

            describe('POST', function() {
                it('should not allow to create resources if the user is not logged in', function(done) {
                    failIfNotLoggedIn('POST', done);
                });

                var testCreate = function(body, hasPartyRoleValues, expectedErr, done) {
                    var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                    utils.validateLoggedIn.and.callFake(function(req, callback) {
                        callback(null);
                    });

                    var tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole']);
                    tmfUtils.hasPartyRole.and.returnValues.apply(tmfUtils.hasPartyRole, hasPartyRoleValues);

                    var billingApi = getBillingAPI(utils, tmfUtils);
                    var req = {
                        method: 'POST',
                        apiUrl: VALID_BILLING_PATH,
                        body: JSON.stringify(body)
                    };

                    billingApi.checkPermissions(req, function(err) {
                        expect(err).toEqual(expectedErr);

                        if ('relatedParty' in body) {
                            expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(
                                req,
                                body.relatedParty,
                                config.billingAccountOwnerRole
                            );
                        }

                        done();
                    });
                };

                it('should not allow to create billing account if an unsupported field is included', function(done) {
                    testCreate({ currency: 'EUR' }, [], UNSUPPORTED_FIELDS_ERROR, done);
                });

                it('should not allow to create billing account if relatedParty field not included', function(done) {
                    var expectedErr = {
                        status: 422,
                        message: 'Billing Accounts cannot be created without related parties'
                    };

                    testCreate({}, [false], expectedErr, done);
                });

                it('should not allow to create billing account if relatedParty field is invalid', function(done) {
                    testCreate({ relatedParty: [] }, [false], INVALID_RELATED_PARTY_ERROR, done);
                });

                it('should fail if customerAccount field not included', function(done) {
                    testCreate({ relatedParty: [] }, [true], CUSTOMER_ACCOUNT_MISSING_ERROR, done);
                });

                it('should not allow to create billing account if customerAccount included but href missing', function(done) {
                    var body = {
                        relatedParty: [],
                        customerAccount: {}
                    };

                    testCreate(body, [true], CUSTOMER_ACCOUNT_MISSING_ERROR, done);
                });

                it('should not allow to create billing account if customerAccount cannot be retrieved', function(done) {
                    var customerAccountPath = '/customerAccount/1';

                    var body = {
                        relatedParty: [],
                        customerAccount: {
                            href: CUSTOMER_SERVER + customerAccountPath
                        }
                    };

                    nock(CUSTOMER_SERVER)
                        .get(customerAccountPath)
                        .reply(500);

                    testCreate(body, [true], CUSTOMER_ACCOUNT_INACCESSIBLE_ERROR, done);
                });

                it('should not allow to create billing account if customer cannot be retrieved', function(done) {
                    var customerAccountPath = '/customerAccount/1';
                    var customerPath = '/customer/1';

                    var body = {
                        relatedParty: [],
                        customerAccount: {
                            href: CUSTOMER_SERVER + customerAccountPath
                        }
                    };

                    nock(CUSTOMER_SERVER)
                        .get(customerAccountPath)
                        .reply(200, { customer: { href: CUSTOMER_SERVER + customerPath } });

                    nock(CUSTOMER_SERVER)
                        .get(customerPath)
                        .reply(500);

                    testCreate(body, [true], CUSTOMER_INACCESSIBLE_ERROR, done);
                });

                var customerAPICorrectResponsesTest = function(hasPartyRoleValues, expectedErr, done) {
                    var customerAccountPath = '/customerAccount/1';
                    var customerPath = '/customer/1';

                    var body = {
                        relatedParty: [],
                        customerAccount: {
                            href: CUSTOMER_SERVER + customerAccountPath
                        }
                    };

                    nock(CUSTOMER_SERVER)
                        .get(customerAccountPath)
                        .reply(200, { customer: { href: CUSTOMER_SERVER + customerPath } });

                    nock(CUSTOMER_SERVER)
                        .get(customerPath)
                        .reply(200, { relatedParty: {} });

                    testCreate(body, hasPartyRoleValues, expectedErr, done);
                };

                it('should not allow to create billing account if customer does not belong to the user', function(done) {
                    customerAPICorrectResponsesTest([true, false], INVALID_CUSTOMER_ERROR, done);
                });

                it('should allow to create billing account if all the fields are valid', function(done) {
                    customerAPICorrectResponsesTest([true, true], null, done);
                });
            });

            describe('PATCH', function() {
                it('should not allow to update resources if the user is not logged in', function(done) {
                    failIfNotLoggedIn('PATCH', done);
                });

                var testUpdate = function(itemPath, body, hasPartyRoleValues, expectedErr, done) {
                    var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                    utils.validateLoggedIn.and.callFake(function(req, callback) {
                        callback(null);
                    });

                    var tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole']);
                    tmfUtils.hasPartyRole.and.returnValues.apply(tmfUtils.hasPartyRole, hasPartyRoleValues);

                    var billingApi = getBillingAPI(utils, tmfUtils);
                    var req = {
                        method: 'PATCH',
                        apiUrl: itemPath,
                        body: JSON.stringify(body)
                    };

                    billingApi.checkPermissions(req, function(err) {
                        expect(err).toEqual(expectedErr);

                        if ('relatedParty' in body) {
                            expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(
                                req,
                                body.relatedParty,
                                config.billingAccountOwnerRole
                            );
                        }

                        done();
                    });
                };

                it('should not allow to update billing account if it cannot be retrieved', function(done) {
                    var billingAccountPath = VALID_BILLING_PATH + '/1';
                    nock(BILLING_SERVER)
                        .get(billingAccountPath)
                        .reply(500);

                    testUpdate(billingAccountPath, {}, [], BILLING_INACCESSIBLE_ERROR, done);
                });

                it('should not allow to update billing account if it does not exist', function(done) {
                    var billingAccountPath = VALID_BILLING_PATH + '/1';

                    nock(BILLING_SERVER)
                        .get(billingAccountPath)
                        .reply(404);

                    testUpdate(billingAccountPath, {}, [], BILLING_DOES_NOT_EXIST_ERROR, done);
                });

                var updateExistingAccount = function(body, hasPartyRoleValues, expectedError, done) {
                    var billingAccountPath = VALID_BILLING_PATH + '/1';

                    nock(BILLING_SERVER)
                        .get(billingAccountPath)
                        .reply(200, { relatedParty: [] });

                    testUpdate(billingAccountPath, body, hasPartyRoleValues, expectedError, done);
                };

                it('should not allow to update billing account if user is not the owner', function(done) {
                    updateExistingAccount({}, [false], NON_OWNED_BILLING_ERROR, done);
                });

                it('should allow to update billing account if user is the owner', function(done) {
                    updateExistingAccount({}, [true], null, done);
                });

                // This method checks that the relatedParty field is checked when updating a billing account
                it('should not allow to update billing account if related party is invalid', function(done) {
                    updateExistingAccount({ relatedParty: [] }, [true, false], INVALID_RELATED_PARTY_ERROR, done);
                });

                // This method checks that the customerAccount field is checked when updating a billing account
                // The rest of the functionality is tested at the time of creating a new billing account
                it('should not allow to update billing account if customer account cannot be checked', function(done) {
                    var customerAccountPath = '/customerAccount/1';

                    var body = {
                        relatedParty: [],
                        customerAccount: {
                            href: CUSTOMER_SERVER + customerAccountPath
                        }
                    };

                    nock(CUSTOMER_SERVER)
                        .get(customerAccountPath)
                        .reply(500);

                    updateExistingAccount(body, [true, true], CUSTOMER_ACCOUNT_INACCESSIBLE_ERROR, done);
                });
            });

            describe('Post Validation', function() {
                var testExecutePostValidation = function(method, body, isRelatedPartyReturnValue, expectedErr, done) {
                    var req = {
                        method: method,
                        body: JSON.stringify(body),
                        apiUrl: 'http://example.com/billingAccount'
                    };

                    var tmfUtils = jasmine.createSpyObj('tmfUtils', ['isRelatedParty']);

                    if (typeof isRelatedPartyReturnValue === 'boolean') {
                        tmfUtils.isRelatedParty.and.returnValue(isRelatedPartyReturnValue);
                    }

                    var billingApi = getBillingAPI({}, tmfUtils);

                    billingApi.executePostValidation(req, function(err) {
                        expect(err).toEqual(expectedErr);

                        if (typeof isRelatedPartyReturnValue === 'boolean') {
                            expect(tmfUtils.isRelatedParty).toHaveBeenCalledWith(req, body.relatedParty);
                        }

                        done();
                    });
                };

                it('should not fail if method is different from GET', function(done) {
                    testExecutePostValidation('POST', {}, null, null, done);
                });

                it('should allow to retrieve collections', function(done) {
                    testExecutePostValidation('GET', [], null, null, done);
                });

                it('should not allow to retrieve asset if the user is not the owner', function(done) {
                    testExecutePostValidation('GET', { relatedParty: [] }, false, RETRIEVAL_UNAUTHORIZED_ERROR, done);
                });

                it('should allow to retrieve resource if the user is the owner', function(done) {
                    testExecutePostValidation('GET', { relatedParty: [] }, true, null, done);
                });
            });
        });

        describe('Product charges', function() {
            var productId = '1';
            var productPath = '/' + config.endpoints.inventory.path + '/api/productInventory/v2/product/' + productId;

            describe('GET', function() {
                var testListCharges = function(expectedErr, isCust, productStatus, query, isOrdCalled, done) {
                    var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                    utils.validateLoggedIn.and.callFake(function(req, callback) {
                        callback(null);
                    });

                    var tmfUtils = jasmine.createSpyObj('tmfUtils', ['isOrderingCustomer']);
                    tmfUtils.isOrderingCustomer.and.callFake(function(userInfo, resourceInfo) {
                        return [true, isCust];
                    });

                    var product = {};
                    nock.cleanAll();
                    nock(PRODUCT_SERVER)
                        .get(productPath)
                        .reply(productStatus, product);

                    var billingApi = getBillingAPI(utils, tmfUtils);
                    var req = {
                        user: {},
                        method: 'GET',
                        apiUrl: VALID_CHARGES_PATH,
                        body: {},
                        query: query
                    };

                    billingApi.checkPermissions(req, function(err) {
                        expect(err).toEqual(expectedErr);

                        if (isOrdCalled) {
                            expect(tmfUtils.isOrderingCustomer).toHaveBeenCalledWith(req.user, product);
                        } else {
                            expect(tmfUtils.isOrderingCustomer).not.toHaveBeenCalled();
                        }

                        done();
                    });
                };

                it('should allow to retrieve a list of charges if the user is the owner', function(done) {
                    testListCharges(null, true, 200, { 'serviceId.id': productId }, true, done);
                });

                it('should not allow to retrieve a list of changes when the product id has not been provided', function(done) {
                    testListCharges(MISSING_PRODUCT_ID_ERROR, true, 200, {}, false, done);
                });

                it('should return an error when it is not possible to access the ralated product', function(done) {
                    testListCharges(PRODUCT_INACCESSIBLE_ERROR, true, 500, { 'serviceId.id': productId }, false, done);
                });

                it('should not allow to retrieve a list of charges when the user is not the customer of the product', function(done) {
                    testListCharges(
                        CHARGES_RETRIEVAL_UNAUTHORIZED,
                        false,
                        200,
                        { 'serviceId.id': productId },
                        true,
                        done
                    );
                });
            });

            describe('Post validation', function() {
                it('should redirect the request when the user if the owner of the charge', function(done) {
                    var body = {
                        serviceId: [
                            {
                                id: productId
                            }
                        ]
                    };
                    var req = {
                        method: 'GET',
                        body: JSON.stringify(body),
                        apiUrl: 'http://example.com/appliedCustomerBillingCharge',
                        user: {}
                    };

                    var product = {};

                    nock.cleanAll();
                    nock(PRODUCT_SERVER)
                        .get(productPath)
                        .reply(200, product);

                    var tmfUtils = jasmine.createSpyObj('tmfUtils', ['isOrderingCustomer']);
                    tmfUtils.isOrderingCustomer.and.callFake(function(userInfo, resourceInfo) {
                        return [true, true];
                    });

                    var billingApi = getBillingAPI({}, tmfUtils);

                    billingApi.executePostValidation(req, function(err) {
                        expect(err).toEqual(null);
                        expect(tmfUtils.isOrderingCustomer).toHaveBeenCalledWith(req.user, product);
                        done();
                    });
                });
            });
        });
    });
});
