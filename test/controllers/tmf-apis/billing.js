var nock = require('nock'),
    proxyquire =  require('proxyquire'),
    testUtils = require('../../utils');

describe('Billing API', function() {

    var config = testUtils.getDefaultConfig();
    var BILLING_SERVER = (config.appSsl ? 'https' : 'http') + '://' + config.appHost + ':' + config.endpoints.billing.port;
    var CUSTOMER_SERVER = (config.appSsl ? 'https' : 'http') + '://' + config.appHost + ':' + config.endpoints.customer.port;

    var VALID_BILLING_PATH = '/' + config.endpoints.billing.path + '/api/billingManagement/v2/billingAccount';

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


    var getBillingAPI = function(utils, tmfUtils) {
        return proxyquire('../../../controllers/tmf-apis/billing', {
            './../../config': config,
            './../../lib/tmfUtils': tmfUtils,
            './../../lib/utils': utils
        }).billing;
    };


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

        describe('GET', function() {

            it('should fail if the user is not logged in', function(done) {
                failIfNotLoggedIn('GET', done);
            });

            var listBillingAccount = function(err, query, done) {

                var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                utils.validateLoggedIn.and.callFake(function(req, callback) {
                    callback(null);
                });

                var tmfUtils = jasmine.createSpyObj('tmfUtils', ['filterRelatedPartyFields']);
                tmfUtils.filterRelatedPartyFields.and.callFake(function(req, callback) {
                    callback(err);
                });

                var billingApi = getBillingAPI(utils, tmfUtils);
                var req = {
                    method: 'GET',
                    apiUrl: VALID_BILLING_PATH + query,
                    body: {}
                };

                billingApi.checkPermissions(req, function(err) {
                    expect(err).toBe(err);
                    done();
                });

            };

            it('should fail if user is trying to list but invalid relatedParty filter', function(done) {

                var returnedError = {
                    status: 403,
                    message: 'Invalid Related Party'
                };

                listBillingAccount(returnedError, '', done);
            });

            it('should fail if user is trying to list but invalid relatedParty filter even if query included', function(done) {

                var returnedError = {
                    status: 403,
                    message: 'Invalid Related Party'
                };

                listBillingAccount(returnedError, '?a=b', done);
            });

            it('should not fail if user is trying to list and related party filter is valid', function(done) {
                listBillingAccount(null, '', done);
            });

            it('should not fail if requesting a single billing account', function(done) {

                //Please note, this is done in the post validation...
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

            it('should fail if the user is not logged in', function(done) {
                failIfNotLoggedIn('POST', done);
            });

            var createTest = function(body, hasPartyRoleValues, expectedErr, done) {

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
                        expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, body.relatedParty,
                            config.billingAccountOwnerRole);
                    }

                    done();
                });
            };

            it('should fail if an unsupported field is included', function(done) {
                createTest({ 'currency': 'EUR' }, [], UNSUPPORTED_FIELDS_ERROR, done);
            });

            it('should fail if relatedParty field not included', function(done) {

                var expectedErr = {
                    status: 422,
                    message: 'Billing Accounts cannot be created without related parties'
                };

                createTest({ }, [false], expectedErr, done);

            });

            it('should fail if relatedParty field is invalid', function(done) {
                createTest({ 'relatedParty': [] }, [false], INVALID_RELATED_PARTY_ERROR, done);
            });

            it('should fail if customerAccount field not included', function(done) {
                createTest({ 'relatedParty': [] }, [true], CUSTOMER_ACCOUNT_MISSING_ERROR, done);
            });

            it('should fail if customerAccount included but href missing', function(done) {

                var body = {
                    'relatedParty': [],
                    'customerAccount': {}
                };

                createTest(body, [true], CUSTOMER_ACCOUNT_MISSING_ERROR, done);
            });

            it('should fail if customerAccount cannot be retrieved', function(done) {

                var customerAccountPath = '/customerAccount/1';

                var body = {
                    'relatedParty': [],
                    'customerAccount': {
                        href: CUSTOMER_SERVER + customerAccountPath
                    }
                };

                nock(CUSTOMER_SERVER)
                    .get(customerAccountPath)
                    .reply(500);

                createTest(body, [true], CUSTOMER_ACCOUNT_INACCESSIBLE_ERROR, done);
            });

            it('should fail if customer cannot be retrieved', function(done) {

                var customerAccountPath = '/customerAccount/1';
                var customerPath = '/customer/1';

                var body = {
                    'relatedParty': [],
                    'customerAccount': {
                        href: CUSTOMER_SERVER + customerAccountPath
                    }
                };

                nock(CUSTOMER_SERVER)
                    .get(customerAccountPath)
                    .reply(200, { customer: { href: CUSTOMER_SERVER + customerPath } });

                nock(CUSTOMER_SERVER)
                    .get(customerPath)
                    .reply(500);

                createTest(body, [true], CUSTOMER_INACCESSIBLE_ERROR, done);

            });

            var customerAPICorrectResponsesTest = function(hasPartyRoleValues, expectedErr, done) {

                var customerAccountPath = '/customerAccount/1';
                var customerPath = '/customer/1';

                var body = {
                    'relatedParty': [],
                    'customerAccount': {
                        href: CUSTOMER_SERVER + customerAccountPath
                    }
                };

                nock(CUSTOMER_SERVER)
                    .get(customerAccountPath)
                    .reply(200, { customer: { href: CUSTOMER_SERVER + customerPath } });

                nock(CUSTOMER_SERVER)
                    .get(customerPath)
                    .reply(200, { relatedParty: {} });

                createTest(body, hasPartyRoleValues, expectedErr, done);

            };

            it('should fail if customer does not belong to the user', function(done) {
                customerAPICorrectResponsesTest([true, false], INVALID_CUSTOMER_ERROR, done);
            });

            it('should not fail if all the fields are valid', function(done) {
                customerAPICorrectResponsesTest([true, true], null, done);
            });
        });

        describe('PATCH', function() {

            it('should fail if the user is not logged in', function(done) {
                failIfNotLoggedIn('PATCH', done);
            });

            var updateTest = function(itemPath, body, hasPartyRoleValues, expectedErr, done) {

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
                        expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, body.relatedParty,
                            config.billingAccountOwnerRole);
                    }

                    done();
                });
            };

            it('should fail if the billing account cannot be retrieved', function(done) {

                var billingAccountPath = VALID_BILLING_PATH + '/1';

                nock(BILLING_SERVER)
                    .get(billingAccountPath)
                    .reply(500);

                updateTest(billingAccountPath, {}, [], BILLING_INACCESSIBLE_ERROR, done)

            });

            it('should fail if the billing account does not exist', function(done) {

                var billingAccountPath = VALID_BILLING_PATH + '/1';

                nock(BILLING_SERVER)
                    .get(billingAccountPath)
                    .reply(404);

                updateTest(billingAccountPath, {}, [], BILLING_DOES_NOT_EXIST_ERROR, done)

            });

            var updateExistingAccount = function(body, hasPartyRoleValues, expectedError, done) {

                var billingAccountPath = VALID_BILLING_PATH + '/1';

                nock(BILLING_SERVER)
                    .get(billingAccountPath)
                    .reply(200, { relatedParty: [] });

                updateTest(billingAccountPath, body, hasPartyRoleValues, expectedError, done)

            };

            it('should fail if user is not the owner of the account', function(done) {
                updateExistingAccount({}, [false], NON_OWNED_BILLING_ERROR, done);
            });

            it('should not fail if user owns the account', function(done) {
                updateExistingAccount({}, [true], null, done);
            });

            // This method checks that the relatedParty field is checked when updating a billing account
            it('should fail if relatedParty field is invalid', function(done) {
                updateExistingAccount({ 'relatedParty': [] }, [true, false], INVALID_RELATED_PARTY_ERROR, done);
            });

            // This method checks that the customerAccount field is checked when updating a billing account
            // The rest of the functionality is tested at the time of creating a new billing account
            it('should fail if customer account cannot be checked', function(done) {

                var customerAccountPath = '/customerAccount/1';

                var body = {
                    'relatedParty': [],
                    'customerAccount': {
                        href: CUSTOMER_SERVER + customerAccountPath
                    }
                };

                nock(CUSTOMER_SERVER)
                    .get(customerAccountPath)
                    .reply(500);

                updateExistingAccount(body, [true, true], CUSTOMER_ACCOUNT_INACCESSIBLE_ERROR, done);
            });
        });

    });

    describe('Post Validation', function() {

        var testExecutePostValidation = function(method, body, isRelatedPartyReturnValue, expectedErr, done) {

            var req = {
                method: method,
                body: JSON.stringify(body)
            };

            var tmfUtils = jasmine.createSpyObj('tmfUtils', ['isRelatedParty']);

            if (typeof(isRelatedPartyReturnValue) === 'boolean') {
                tmfUtils.isRelatedParty.and.returnValue(isRelatedPartyReturnValue);
            }

            var billingApi = getBillingAPI({}, tmfUtils);

            billingApi.executePostValidation(req, function(err) {
                expect(err).toEqual(expectedErr);

                if (typeof(isRelatedPartyReturnValue) === 'boolean') {
                    expect(tmfUtils.isRelatedParty).toHaveBeenCalledWith(req, body.relatedParty);
                }

                done();
            });
        };

        it('should not fail if method is different from GET', function(done) {
            testExecutePostValidation('POST', {}, null, null, done);
        });

        it('should not fail if body contains an array', function(done) {
            testExecutePostValidation('GET', [], null, null, done);
        });

        it('should fail if the user is not the owner of the asset', function(done) {
            testExecutePostValidation('GET', {relatedParty: []}, false, RETRIEVAL_UNAUTHORIZED_ERROR, done);
        });

        it('should not fail if the user is the owner of the asset', function(done) {
            testExecutePostValidation('GET', {relatedParty: []}, true, null, done);
        });
        
    });
});