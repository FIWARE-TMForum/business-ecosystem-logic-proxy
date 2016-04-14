var nock = require('nock'),
    proxyquire =  require('proxyquire'),
    testUtils = require('../../utils');

describe('Customer API', function() {

    var config = testUtils.getDefaultConfig();
    var BILLING_SERVER = (config.appSsl ? 'https' : 'http') + '://' + config.appHost + ':' + config.endpoints.billing.port;
    var CUSTOMER_SERVER = (config.appSsl ? 'https' : 'http') + '://' + config.appHost + ':' + config.endpoints.customer.port;

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

        var failIfNotLoggedIn = function(method, done) {

            var returnedError = {
                status: 401,
                message: 'User not logged in'
            };

            var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
            utils.validateLoggedIn.and.callFake(function(req, callback) {
                callback(returnedError);
            });

            var customerApi = getCustomerAPI(utils, {});
            var req = {
                method: method,
                apiUrl: VALID_CUSTOMER_PATH,
                body: {}
            };

            customerApi.checkPermissions(req, function(err) {
                expect(err).toBe(returnedError);
                done();
            });
        };

        describe('General', function() {

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

            it('should reject requests with unrecognized methods', function(done) {
                var customerApi = getCustomerAPI({}, {});
                var req = {
                    method: 'PUT',
                    apiUrl: VALID_CUSTOMER_PATH
                };

                customerApi.checkPermissions(req, function(err) {

                    expect(err).toEqual({
                        status: 405,
                        message: 'Method not allowed'
                    });

                    done();
                });
            });

            it('should reject requests with invalid body', function(done) {
                var customerApi = getCustomerAPI({}, {});
                var req = {
                    method: 'POST',
                    apiUrl: VALID_CUSTOMER_PATH,
                    body: 'invalid'
                };

                customerApi.checkPermissions(req, function(err) {

                    expect(err).toEqual({
                        status: 400,
                        message: 'Invalid body'
                    });

                    done();
                });
            });
        });

        describe('GET', function() {

            it('should fail if user is not logged in', function(done) {
                failIfNotLoggedIn('GET', done);
            });

            var testListCustomerAccount = function(path, done) {

                var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                utils.validateLoggedIn.and.callFake(function(req, callback) {
                    callback(null);
                });

                var customerApi = getCustomerAPI(utils, {});
                var req = {
                    method: 'GET',
                    apiUrl: path,
                    body: {}
                };

                customerApi.checkPermissions(req, function(err) {
                    expect(err).toEqual({
                        status: 403,
                        message: 'Unauthorized to retrieve the list of customer accounts'
                    });
                    done();
                });
            };

            it('should fail if listing customer accounts', function(done) {
                testListCustomerAccount(VALID_CUSTOMER_ACCOUNT_PATH, done);
            });

            it('should fail if listing customer accounts even if query included', function(done) {
                testListCustomerAccount(VALID_CUSTOMER_ACCOUNT_PATH + '/?a=b', done);
            });

            var testListCustomer = function(expectedErr, done) {

                var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                utils.validateLoggedIn.and.callFake(function(req, callback) {
                    callback(null);
                });

                var tmfUtils = jasmine.createSpyObj('tmfUtils', ['filterRelatedPartyFields']);
                tmfUtils.filterRelatedPartyFields.and.callFake(function(req, callback) {
                    callback(expectedErr);
                });

                var customerApi = getCustomerAPI(utils, tmfUtils);
                var req = {
                    method: 'GET',
                    apiUrl: VALID_CUSTOMER_PATH,
                    body: {}
                };

                customerApi.checkPermissions(req, function(err) {
                    expect(err).toBe(expectedErr);
                    done();
                });
            };

            it('should fail if listing customer with invalid filter', function(done) {
                testListCustomer({status: 403, message: 'Invalid filter'}, done);
            });

            it('should not fail if listing customer with valid filter', function(done) {
                testListCustomer(null, done);
            });

            var testGetResource = function(path, done) {

                var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                utils.validateLoggedIn.and.callFake(function(req, callback) {
                    callback(null);
                });

                var customerApi = getCustomerAPI(utils, {});
                var req = {
                    method: 'GET',
                    apiUrl: path,
                    body: {}
                };

                customerApi.checkPermissions(req, function(err) {
                    expect(err).toBe(null);
                    done();
                });
            };

            it('should allow to retrieve one customer', function(done) {
                testGetResource(VALID_CUSTOMER_PATH + '/1', done);
            });

            it('should allow to retrieve one customer account', function(done) {
                testGetResource(VALID_CUSTOMER_ACCOUNT_PATH + '/1', done);
            });

        });

        describe('POST', function() {

            it('should fail if the user is not logged in', function(done) {
                failIfNotLoggedIn('POST', done);
            });

            var testCreate = function(path, body, hasPartyRole, expectedPartyCall, expectedErr, done) {

                var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                utils.validateLoggedIn.and.callFake(function(req, callback) {
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

                customerApi.checkPermissions(req, function(err) {

                    expect(err).toEqual(expectedErr);

                    if (expectedPartyCall) {
                        expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, expectedPartyCall, 'owner');
                    }

                    done();
                });

            };

            it('should fail when creating customer without related party', function(done) {

                var expectedErr = {
                    status: 422,
                    message: 'Unable to create customer without specifying the related party'
                };

                testCreate(VALID_CUSTOMER_PATH, {}, false, null, expectedErr, done);

            });

            it('should fail when creating a customer with invalid related party', function(done) {

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

            it('should allow to create customer with valid related party', function(done) {

                var body = {
                    relatedParty: {
                        id: 7
                    }
                };

                testCreate(VALID_CUSTOMER_PATH, body, true, [body.relatedParty], null, done);
            });

            it('should fail when creating customer with customerAccount', function(done) {

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

            it('should fail when creating customer account without customer', function(done) {

                var expectedErr = {
                    status: 422,
                    message: 'Customer Accounts must be associated to a Customer'
                };

                testCreate(VALID_CUSTOMER_ACCOUNT_PATH, {}, false, null, expectedErr, done);
            });

            it('should fail when creating a customer account with invalid customer', function(done) {

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

            it('should fail when creating a customer account and customer cannot be retrieved', function(done) {

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

            var testCreateAccountExistingCustomer = function(hasPartyRole, expectedErr, done) {

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

            it('should fail when creating a customer account and customer does not belong to the user', function(done) {

                var expectedErr = {
                    status: 403,
                    message: 'The given Customer does not belong to the user making the request'
                };

                testCreateAccountExistingCustomer(false, expectedErr, done);

            });

            it('should allow to create customer account', function(done) {
                testCreateAccountExistingCustomer(true, null, done);
            });

        });

        describe('PATCH', function() {

            it('should fail if the user is not logged in', function(done) {
                failIfNotLoggedIn('PATCH', done);
            });

            var testUpdate = function(path, body, hasPartyRole, expectedPartyCall, expectedErr, done) {

                var utils = jasmine.createSpyObj('utils', ['validateLoggedIn']);
                utils.validateLoggedIn.and.callFake(function(req, callback) {
                    callback(null);
                });

                var tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole']);
                tmfUtils.hasPartyRole.and.returnValue(hasPartyRole);

                var customerApi = getCustomerAPI(utils, tmfUtils);
                var req = {
                    method: 'PATCH',
                    apiUrl: path,
                    body: JSON.stringify(body)
                };

                customerApi.checkPermissions(req, function(err) {
                    expect(err).toEqual(expectedErr);

                    if (expectedPartyCall) {
                        expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, expectedPartyCall, 'owner');
                    }

                    done();
                });

            };

            it('should fail when updating a customer (account)? and it cannot be retrieved', function(done) {

                // This test is valid for customer and customer accounts
                var customerPath = VALID_CUSTOMER_PATH + '/8';

                nock(CUSTOMER_SERVER)
                    .get(customerPath)
                    .reply(500);

                var expectedErr = {
                    status: 500,
                    message: 'The required resource cannot be retrieved'
                };

                testUpdate(customerPath, {}, false, null, expectedErr, done);
            });

            it('should fail when updating a customer (account)? that does not exist', function(done) {

                // This test is valid for customer and customer accounts
                var customerPath = VALID_CUSTOMER_PATH + '/8';

                nock(CUSTOMER_SERVER)
                    .get(customerPath)
                    .reply(404);

                var expectedErr = {
                    status: 404,
                    message: 'The required resource does not exist'
                };

                testUpdate(customerPath, {}, false, null, expectedErr, done);
            });

            var testUpdateCustomer = function(body, hasPartyRole, expectedErr, done) {

                var customerPath = VALID_CUSTOMER_PATH + '/8';

                var customer = {
                    relatedParty: {
                        id: 9
                    }
                };

                nock(CUSTOMER_SERVER)
                    .get(customerPath)
                    .reply(200, customer);

                testUpdate(customerPath, body, hasPartyRole, [customer.relatedParty], expectedErr, done);
            };

            it('should fail when updating a non-owned customer', function(done) {
                testUpdateCustomer({}, false, UNAUTHORIZED_UPDATE_RESOURCE_ERROR, done);
            });

            it('should fail to update a customer when related party included', function(done) {

                var expectedErr = {
                    status: 403,
                    message: 'Related Party cannot be modified'
                };

                testUpdateCustomer({ relatedParty: {} }, true, expectedErr, done);
            });

            it('should allow to update a customer', function(done) {
                testUpdateCustomer({}, true, null, done);
            });


            it('should fail when updating a customer account and the attached customer cannot be retrieved', function(done) {

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

                testUpdate(customerAccountPath, {}, false, null, CUSTOMER_CANNOT_BE_RETRIEVED_ERROR, done);

            });

            var testUpdateCustomerAccountExistingCustomer = function(body, hasPartyRole, expectedErr, done) {

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

                testUpdate(customerAccountPath, body, hasPartyRole, [customer.relatedParty], expectedErr, done);
            };

            it('should fail when updating a customer account and the attached customer does not belong to the user', function(done) {
                testUpdateCustomerAccountExistingCustomer({}, false, UNAUTHORIZED_UPDATE_RESOURCE_ERROR, done);
            });

            it('should allow to update a customer account', function(done) {
                testUpdateCustomerAccountExistingCustomer({}, true, null, done);
            });

            it('should fail when updating a customer account and customer included', function(done) {

                var expectedErr = {
                    status: 403,
                    message: 'Customer cannot be modified'
                };

                testUpdateCustomerAccountExistingCustomer({customer: {}}, true, expectedErr, done);
            });

        });

    });

});