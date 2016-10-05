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

var nock = require('nock'),
    proxyquire =  require('proxyquire'),
    Promise = require('promiz'),
    md5 = require("blueimp-md5"),
    testUtils = require('../../utils');

describe('Ordering API', function() {

    var config = testUtils.getDefaultConfig();
    var SERVER = (config.appSsl ? 'https' : 'http') + '://' + config.appHost + ':' + config.endpoints.ordering.port;
    var CATALOG_SERVER = (config.appSsl ? 'https' : 'http') + '://' + config.appHost + ':' + config.endpoints.catalog.port;
    var BILLING_SERVER = (config.appSsl ? 'https' : 'http') + '://' + config.appHost + ':' + config.endpoints.billing.port;

    // Errors
    var BILLING_ACCOUNT_REQUIRED = {
        status: 422,
        message: 'Billing Account is required'
    };

    var BILLING_ACCOUNTS_MISMATCH = {
        status: 422,
        message: 'Billing Accounts must be the same for all the order items contained in the ordering'
    };


    var getOrderingAPI = function(storeClient, tmfUtils, utils, indexes) {
        if (!indexes) {
            indexes = {
                safeIndexExecute: function () {
                    return Promise.resolve();
                }
            };
        }

        return proxyquire('../../../controllers/tmf-apis/ordering', {
            './../../config': config,
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/store': storeClient,
            './../../lib/tmfUtils': tmfUtils,
            './../../lib/indexes': indexes,
            './../../lib/indexes.js': indexes,
            './../../lib/utils': utils
        }).ordering;
    };

    var validateLoggedOk = function (req, callback) {
        callback();
    };

    var getIndividualURL = function(user) {
        return 'http://belp.fiware.org:7891/party/api/partyManagement/v2/individual/' + (user ? user : '');
    };

    beforeEach(function() {
        nock.cleanAll();
    });

    describe('Get Permissions', function() {

        //////////////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////// NOT AUTHENTICATED /////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        describe('Not Authenticated Requests', function() {

            var validateLoggedError = function (req, callback) {
                callback({
                    status: 401,
                    message: 'You need to be authenticated to create/update/delete resources'
                });
            };

            var testNotLoggedIn = function (method, done) {

                var utils = {
                    validateLoggedIn: validateLoggedError
                };

                var orderingApi = getOrderingAPI({}, {}, utils);
                var path = '/ordering';

                // Call the method
                var req = {
                    method: method,
                    url: path
                };

                orderingApi.checkPermissions(req, function (err) {

                    expect(err).not.toBe(null);
                    expect(err.status).toBe(401);
                    expect(err.message).toBe('You need to be authenticated to create/update/delete resources');

                    done();
                });
            };

            it('should reject not authenticated GET requests', function (done) {
                testNotLoggedIn('GET', done);
            });

            it('should reject not authenticated POST requests', function (done) {
                testNotLoggedIn('POST', done);
            });

            it('should reject not authenticated PATCH requests', function (done) {
                testNotLoggedIn('PATCH', done);
            });

        });


        //////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////// NOT ALLOWED ////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        describe('Not allowed methods', function() {

            var methodNotAllowedStatus = 405;
            var methodNotAllowedMessage = 'This method used is not allowed in the accessed API';

            var methodNotAllowed = function (req, callback) {
                callback({
                    status: methodNotAllowedStatus,
                    message: methodNotAllowedMessage
                });
            };

            var testMethodNotAllowed = function (method, done) {

                var utils = {
                    methodNotAllowed: methodNotAllowed
                };

                var orderingApi = getOrderingAPI({}, {}, utils);
                var path = '/ordering';

                // Call the method
                var req = {
                    method: method,
                    url: path
                };

                orderingApi.checkPermissions(req, function (err) {

                    expect(err).not.toBe(null);
                    expect(err.status).toBe(methodNotAllowedStatus);
                    expect(err.message).toBe(methodNotAllowedMessage);

                    done();
                });
            };

            it('should reject not authenticated PUT requests', function (done) {
                testMethodNotAllowed('PUT', done);
            });

            it('should reject not authenticated DELETE requests', function (done) {
                testMethodNotAllowed('DELETE', done);
            });

        });

        //////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////// RETRIEVAL //////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        describe('GET', function() {

            var testRetrieval = function (filterRelatedPartyFields, expectedErr, done) {

                var ensureRelatedPartyIncludedCalled = false;

                var tmfUtils = {

                    filterRelatedPartyFields: filterRelatedPartyFields,

                    ensureRelatedPartyIncluded: function(req, callback) {
                        ensureRelatedPartyIncludedCalled = true;
                        callback(null);
                    }
                };

                var utils = {
                    validateLoggedIn: function (req, callback) {
                        callback(null);
                    }
                };

                var req = {
                    method: 'GET'
                };

                var orderingApi = getOrderingAPI({}, tmfUtils, utils);

                orderingApi.checkPermissions(req, function (err) {

                    expect(ensureRelatedPartyIncludedCalled).toBe(true);
                    expect(err).toEqual(expectedErr);

                    done();
                });

            };

            it('should call callback with error when retrieving list of orderings and using invalid filters', function (done) {

                var error = {
                    status: 401,
                    message: 'Invalid filters'
                };

                var filterRelatedPartyFields = function (req, callback) {
                    callback(error);
                };

                testRetrieval(filterRelatedPartyFields, error, done);

            });

            it('should call callback without errors when user is allowed to retrieve the list of orderings', function (done) {

                var filterRelatedPartyFields = function (req, callback) {
                    callback();
                };

                testRetrieval(filterRelatedPartyFields, null, done);

            });

            //////////////////////////////////////////////////////////////////////////////////////////////
            ///////////////////////////////////////// INDEXES / //////////////////////////////////////////
            //////////////////////////////////////////////////////////////////////////////////////////////

            describe('Test index in checkPermissions middleware', function() {

                var requestHelper = function requestHelper(done, results, url, query, expectedUrl, expectedQuery) {
                    var pathname = "/productOrder";
                    url = pathname + "?" + url;
                    expectedUrl = pathname + "?" + expectedUrl;

                    var indexes = {
                        searchOrders: q => {
                            if (expectedQuery) {
                                expect(q).toEqual(expectedQuery);
                            }


                            return Promise.resolve({
                                hits: results.map(x => ({document: {originalId: x}}))
                            });
                        }
                    };

                    var orderApi = getOrderingAPI({}, {}, {}, indexes);
                    var req = {
                        method: "GET",
                        apiUrl: url,
                        _parsedUrl: {
                            pathname: pathname
                        },
                        query: query
                    };

                    orderApi.checkPermissions(req, function() {
                        expect(req.apiUrl).toEqual(expectedUrl);
                        done();
                    });
                };

                it('should not change request URL when order index fails', function(done) {
                    var indexes = {
                        searchOrders: () => Promise.reject("Error")
                    };
                    var orderApi = getOrderingAPI({}, {}, {}, indexes);
                    var url = "/productOrder?relatedParty.id=rock";
                    var req = {
                        method: "GET",
                        apiUrl: url,
                        _parsedUrl: {
                            pathname: "/productOrder"
                        },
                        query: {
                            "relatedParty.id": "rock"
                        }
                    };

                    orderApi.checkPermissions(req, function() {
                        expect(req.apiUrl).toEqual(url);
                        done();
                    });
                });

                it('should change request URL to include order IDs when relatedParty.id is provided', function(done) {
                    requestHelper(done,
                                  [3, 4],
                                  "relatedParty.id=rock",
                                  {
                                      "relatedParty.id": "rock"
                                  },
                                  "id=3,4",
                                  {
                                      offset: 0,
                                      pageSize: 25,
                                      sort: ["sortedId", "asc"],
                                      query: {AND: [{relatedPartyHash: [md5("rock")]}]}
                                  }
                                 );
                });

                var testQueryParameters = function testQueryParameters(done, params) {
                    // Transform object to param=value&param2=value2
                    var paramUrl = Object.keys(params).map(key => key + "=" + params[key]).join("&");
                    // Transform object to index AND query (String keys must be lower case to perform index search correctly)
                    var ANDs = Object.keys(params)
                            .map(key => (
                                {[key]: [ (typeof params[key] === "string") ? params[key].toLowerCase() : params[key]]}));

                    requestHelper(done,
                                  [7, 9, 11],
                                  paramUrl,
                                  params,
                                  "id=7,9,11",
                                  {
                                      offset: 0,
                                      pageSize: 25,
                                      sort: ["sortedId", "asc"],
                                      query: {AND: ANDs}
                                  });
                };

                it('should should change URL to include order IDs when no parameter are provided', function(done) {
                    requestHelper(done,
                                  [1, 2],
                                  "",
                                  {},
                                  "id=1,2",
                                  {
                                      offset: 0,
                                      pageSize: 25,
                                      sort: ["sortedId", "asc"],
                                      query: {AND: [{"*": ["*"]}]}
                                  });
                });

                it('should change request URL to not add any id if no order results', function(done) {
                    requestHelper(done,
                                  [],
                                  "relatedParty.id=someother",
                                  {
                                      "relatedParty.id": "someother"
                                  },
                                  "id=",
                                  {
                                      offset: 0,
                                      pageSize: 25,
                                      sort: ["sortedId", "asc"],
                                      query: {AND: [{relatedPartyHash: [md5("someother")]}]}
                                  });
                });

                it('should change request URL adding extra params and ids', function(done) {
                    requestHelper(done,
                                  [1, 2],
                                  "depth=2&fields=name",
                                  {
                                      depth: "2",
                                      fields: "name"
                                  },
                                  "id=1,2&depth=2&fields=name",
                                  {
                                      offset: 0,
                                      pageSize: 25,
                                      sort: ["sortedId", "asc"],
                                      query: {AND: [{"*": ["*"]}]}
                                  });

                });

                it('should change request URL to include order IDs when priority is provided', function(done) {
                    testQueryParameters(done, { priority: "prior"});
                });

                it('should change request URL to include order IDs when category is provided', function(done) {
                    testQueryParameters(done, { category: "category1" });
                });

                it('should change request URL to include order IDs when state is provided', function(done) {
                    testQueryParameters(done, { state: "OK" });
                });

                it('should change request URL to include order IDs when notification contact is provided', function(done) {
                    testQueryParameters(done, { notificationContact: "a@b.c" });
                });

                it('should change request URL to include order IDs when note is provided', function(done) {
                    testQueryParameters(done, { note: "some note" });
                });
            });
        });


        //////////////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////// CREATION //////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        describe('Creation', function() {

            var testOrderCreation = function (userInfo, body, customerRoleRequired, isCustomer, hasPartyRole, expectedRes, done, checkReq) {

                config.customerRoleRequired = customerRoleRequired;

                var utils = {
                    validateLoggedIn: validateLoggedOk,
                    hasRole: function() {
                        return isCustomer
                    }
                };

                var tmfUtils = jasmine.createSpyObj('tmfUtils', ['getIndividualURL', 'hasPartyRole']);
                tmfUtils.getIndividualURL.and.returnValue(getIndividualURL());
                tmfUtils.hasPartyRole.and.returnValue(hasPartyRole);

                var orderingApi = getOrderingAPI({}, tmfUtils, utils);

                var req = {
                    user: userInfo,
                    method: 'POST',
                    body: body,
                    headers: {}
                };

                orderingApi.checkPermissions(req, function (err) {
                    expect(err).toEqual(expectedRes);

                    if (checkReq) {
                        checkReq(req);
                    }

                    done();
                });

            };

            var testValidOrdering = function (nOrderItems, isCustomer, customerRoleRequired, isBundle, done) {

                var userName = 'example';
                var billingAccountPath = '/billingAccount/7';
                var productOfferingBundlePath ='/productOffering/2';
                var productOfferingPath = '/productOffering/1';
                var productSpecPath = '/product/2';
                var ownerName = 'ownerUser';

                var user = {
                    id: userName
                };

                var orderItems = [];

                for (var i = 0; i < nOrderItems; i++) {
                    var offeringPath = !isBundle  ? productOfferingPath : productOfferingBundlePath;
                    orderItems.push({
                        product: {},
                        productOffering: {
                            href: 'http://extexample.com' + offeringPath
                        },
                        billingAccount: [
                            {
                                id: 7,
                                href: BILLING_SERVER + billingAccountPath
                            }
                        ]
                    });
                }

                var body = {
                    relatedParty: [{
                        id: userName,
                        role: 'customer'
                    }],
                    orderItem: orderItems
                };

                nock(CATALOG_SERVER)
                    .get(productOfferingBundlePath)
                    .times(nOrderItems)
                    .reply(200, {isBundle: true, bundledProductOffering: [{href: SERVER + productOfferingPath}]});

                nock(CATALOG_SERVER)
                    .get(productOfferingPath)
                    .times(nOrderItems)
                    .reply(200, {productSpecification: {href: SERVER + productSpecPath}});

                nock(CATALOG_SERVER)
                    .get(productSpecPath)
                    .times(nOrderItems)
                    .reply(200, {relatedParty: [{id: ownerName, role: 'owner'}]});

                nock(BILLING_SERVER)
                    .get(billingAccountPath)
                    .reply(200, {relatedParty: [{id: ownerName, role: config.billingAccountOwnerRole}]});

                testOrderCreation(user, JSON.stringify(body), customerRoleRequired, isCustomer, true, null, done, function (req) {

                    var newBody = JSON.parse(req.body);
                    //expect(req.headers['content-length']).toBe(newBody.length);

                    expect(newBody.orderItem[0].product.relatedParty).toEqual([
                        {
                            id: userName,
                            role: 'Customer',
                            href: getIndividualURL(userName)
                        },
                        {
                            id: ownerName,
                            role: 'Seller',
                            href: getIndividualURL(ownerName)
                        }]);
                });
            };

            it('should call the callback after validating the request when the user is not customer but customer role not required', function (done) {
                testValidOrdering(1, false, false, false, done);
            });

            it('should call the callback after validating the request when the user is customer (1 order item)', function (done) {
                testValidOrdering(1, true, true, false, done);
            });

            it('should call the callback after validating the request when the user is customer (2 order items)', function (done) {
                testValidOrdering(2, true, true, false, done);
            });

            it('should call the callback after validating the request when the offering is a bundle', function(done) {
                testValidOrdering(1, true, true, true, done);
            });

            var billingAccountError = function(itemsGenerator, expectedError, hasPartyRole, done) {
                var userName = 'cust';
                var productOfferingPath = '/productOffering/1';
                var productSpecPath = '/product/2';
                var ownerName = 'example';

                var user = {
                    id: userName
                };

                var orderItems = itemsGenerator(productOfferingPath);

                var body = {
                    relatedParty: [{
                        id: userName,
                        role: 'customer'
                    }],
                    orderItem: orderItems
                };

                nock(CATALOG_SERVER)
                    .get(productOfferingPath)
                    .times(orderItems.length)
                    .reply(200, {productSpecification: {href: SERVER + productSpecPath}});

                nock(CATALOG_SERVER)
                    .get(productSpecPath)
                    .times(orderItems.length)
                    .reply(200, {relatedParty: [{id: ownerName, role: 'owner'}]});

                testOrderCreation(user, JSON.stringify(body), true, true, hasPartyRole, expectedError, done);
            };

            it('should fail when items does not contain billing account key', function(done) {

                var itemsGenerator = function(productOfferingPath) {
                    return [{
                        product: {},
                        productOffering: {
                            href: 'http://extexample.com' + productOfferingPath
                        }
                    }];
                };

                billingAccountError(itemsGenerator, BILLING_ACCOUNT_REQUIRED, true, done);
            });

            it('should fail when items contains billing account key but it is empty', function(done) {

                var itemsGenerator = function(productOfferingPath) {
                    return [{
                        product: {},
                        productOffering: {
                            href: 'http://extexample.com' + productOfferingPath
                        },
                        billingAccount: []
                    }];
                };

                billingAccountError(itemsGenerator, BILLING_ACCOUNT_REQUIRED, true, done);
            });

            it('should fail when items contains billing account but href is not included', function(done) {

                var itemsGenerator = function(productOfferingPath) {
                    return [{
                        product: {},
                        productOffering: {
                            href: 'http://extexample.com' + productOfferingPath
                        },
                        billingAccount: [{
                            id: 7
                        }]
                    }];
                };

                billingAccountError(itemsGenerator, BILLING_ACCOUNT_REQUIRED, true, done);
            });

            it('should fail when the second item does not contain a billing account', function(done) {

                var itemsGenerator = function(productOfferingPath) {
                    return [
                        {
                            product: {},
                            productOffering: {
                                href: 'http://extexample.com' + productOfferingPath
                            },
                            billingAccount: [{
                                id: 7,
                                href: 'http://example.com/billingAccount/7'
                            }]
                        },
                        {
                            product: {},
                            productOffering: {
                                href: 'http://extexample.com' + productOfferingPath
                            }
                        }];
                };

                billingAccountError(itemsGenerator, BILLING_ACCOUNTS_MISMATCH, true, done);

            });

            it('should fail when the second item contains a different billing account', function(done) {

                var itemsGenerator = function(productOfferingPath) {
                    return [
                        {
                            product: {},
                            productOffering: {
                                href: 'http://extexample.com' + productOfferingPath
                            },
                            billingAccount: [{
                                id: 7,
                                href: 'http://example.com/billingAccount/7'
                            }]
                        },
                        {
                            product: {},
                            productOffering: {
                                href: 'http://extexample.com' + productOfferingPath
                            },
                            billingAccount: [{
                                id: 8,
                                href: 'http://example.com/billingAccount/8'
                            }]
                        }];
                };

                billingAccountError(itemsGenerator, BILLING_ACCOUNTS_MISMATCH, true, done);
            });

            it('should fail when the billing account does not exist', function(done) {

                var billingAccountPath = '/billingAccount/7';

                var itemsGenerator = function(productOfferingPath) {
                    return [
                        {
                            product: {},
                            productOffering: {
                                href: 'http://extexample.com' + productOfferingPath
                            },
                            billingAccount: [{
                                id: 7,
                                href: 'http://example.com' + billingAccountPath
                            }]
                        }];
                };

                nock(BILLING_SERVER)
                    .get(billingAccountPath)
                    .reply(404);

                var expectedError = {
                    status: 422,
                    message: 'The given billing account does not exist'
                };

                billingAccountError(itemsGenerator, expectedError, true, done);
            });

            it('should fail when the billing API fails to return the billing account', function(done) {

                var billingAccountPath = '/billingAccount/7';

                var itemsGenerator = function(productOfferingPath) {
                    return [
                        {
                            product: {},
                            productOffering: {
                                href: 'http://extexample.com' + productOfferingPath
                            },
                            billingAccount: [{
                                id: 7,
                                href: 'http://example.com' + billingAccountPath
                            }]
                        }];
                };

                nock(BILLING_SERVER)
                    .get(billingAccountPath)
                    .reply(400);

                var expectedError = {
                    status: 500,
                    message: 'There was an unexpected error at the time of retrieving the provided billing account'
                };

                billingAccountError(itemsGenerator, expectedError, true, done);
            });

            it('should fail when the billing account is not owned by the user', function(done) {

                var billingAccountPath = '/billingAccount/7';

                var itemsGenerator = function(productOfferingPath) {
                    return [
                        {
                            product: {},
                            productOffering: {
                                href: 'http://extexample.com' + productOfferingPath
                            },
                            billingAccount: [{
                                id: 7,
                                href: 'http://example.com' + billingAccountPath
                            }]
                        }];
                };

                nock(BILLING_SERVER)
                    .get(billingAccountPath)
                    .reply(200, { relatedParty: [] });

                var expectedError = {
                    status: 403,
                    message: 'Unauthorized to use non-owned billing accounts'
                };

                billingAccountError(itemsGenerator, expectedError, false, done);
            });

            it('should fail if the product has not owners', function (done) {

                var productOfferingPath = '/productOffering/1';
                var productSpecPath = '/product/2';
                var ownerName = 'example';

                var user = {
                    id: 'cust'
                };

                var body = {
                    relatedParty: [{
                        id: 'cust',
                        role: 'customer'
                    }],
                    orderItem: [{
                        product: {},
                        productOffering: {
                            href: SERVER + productOfferingPath
                        }
                    }]
                };

                nock(CATALOG_SERVER)
                    .get(productOfferingPath)
                    .reply(200, {productSpecification: {href: SERVER + productSpecPath}});

                nock(CATALOG_SERVER)
                    .get(productSpecPath)
                    .reply(200, {relatedParty: [{id: ownerName, role: 'other_role'}]});

                var expected = {
                    status: 400,
                    message: 'You cannot order a product without owners'
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);

            });

            it('should fail if the offering attached to the order cannot be retrieved', function (done) {

                var SERVER = 'http://example.com';
                var productOfferingPath = '/productOffering/1';

                var orderItemId = 1;

                var user = {
                    id: 'cust'
                };

                var body = {
                    relatedParty: [{
                        id: 'cust',
                        role: 'customer'
                    }],
                    orderItem: [{
                        id: orderItemId,
                        product: {},
                        productOffering: {
                            href: SERVER + productOfferingPath
                        }
                    }]
                };

                nock(CATALOG_SERVER)
                    .get(productOfferingPath)
                    .reply(500);

                var expected = {
                    status: 400,
                    message: 'The system fails to retrieve the offering attached to the ordering item ' + orderItemId
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail if the product attached to the order cannot be retrieved', function (done) {

                var SERVER = 'http://example.com';
                var productOfferingPath = '/productOffering/1';
                var productSpecPath = '/product/2';

                var orderItemId = 1;

                var user = {
                    id: 'cust'
                };

                var body = {
                    relatedParty: [{
                        id: 'cust',
                        role: 'customer'
                    }],
                    orderItem: [{
                        id: orderItemId,
                        product: {},
                        productOffering: {
                            href: SERVER + productOfferingPath
                        }
                    }]
                };

                nock(CATALOG_SERVER)
                    .get(productOfferingPath)
                    .reply(200, {productSpecification: {href: SERVER + productSpecPath}});

                nock(CATALOG_SERVER)
                    .get(productSpecPath)
                    .reply(500);

                var expected = {
                    status: 400,
                    message: 'The system fails to retrieve the product attached to the ordering item ' + orderItemId
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);

            });

            it('should fail when the order is not well formed JSON', function (done) {
                var user = {
                    id: 'customer'
                };

                var expected = {
                    status: 400,
                    message: 'The resource is not a valid JSON document'
                };

                testOrderCreation(user, 'invalid', true, true, true, expected, done);
            });

            it('should fail when the user does not have the customer role', function (done) {
                var user = {
                    id: 'test'
                };

                var expected = {
                    status: 403,
                    message: 'You are not authorized to order products'
                };

                var body = {
                    relatedParty: [{
                        id: 'test',
                        role: 'customer'
                    }]
                };
                testOrderCreation(user, JSON.stringify(body), true, false, true, expected, done);
            });

            it('should fail when the relatedParty field has not been included', function (done) {
                var user = {
                    id: 'cust'
                };

                var expected = {
                    status: 400,
                    message: 'A product order must contain a relatedParty field'
                };

                testOrderCreation(user, JSON.stringify({}), true, true, true, expected, done);
            });

            it('should fail when a customer has not been specified', function (done) {
                var user = {
                    id: 'cust'
                };

                var expected = {
                    status: 403,
                    message: 'It is required to specify a customer in the relatedParty field'
                };

                var body = {
                    relatedParty: [{
                        id: 'cust',
                        role: 'seller'
                    }]
                };
                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail when the specified customer is not the user making the request', function (done) {
                var user = {
                    id: 'cust'
                };

                var expected = {
                    status: 403,
                    message: 'The customer specified in the product order is not the user making the request'
                };

                var body = {
                    relatedParty: [{
                        id: 'test',
                        role: 'customer'
                    }]
                };
                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail when the request does not include an orderItem field', function (done) {
                var user = {
                    id: 'cust'
                };

                var expected = {
                    status: 400,
                    message: 'A product order must contain an orderItem field'
                };

                var body = {
                    relatedParty: [{
                        id: 'cust',
                        role: 'customer'
                    }]
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail when the request does not include a product in an orderItem', function (done) {
                var user = {
                    id: 'cust'
                };

                var expected = {
                    status: 400,
                    message: 'The product order item 1 must contain a product field'
                };

                var body = {
                    relatedParty: [{
                        id: 'cust',
                        role: 'customer'
                    }],
                    orderItem: [{
                        id: '1'
                    }]
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail when the request does not include a productOffering in an orderItem', function (done) {
                var user = {
                    id: 'cust'
                };

                var expected = {
                    status: 400,
                    message: 'The product order item 1 must contain a productOffering field'
                };

                var body = {
                    relatedParty: [{
                        id: 'cust',
                        role: 'customer'
                    }],
                    orderItem: [{
                        id: '1',
                        product: {}
                    }]
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail when an invalid customer has been specified in a product of an orderItem', function (done) {
                var user = {
                    id: 'cust'
                };

                var expected = {
                    status: 403,
                    message: 'The customer specified in the order item 1 is not the user making the request'
                };

                var body = {
                    relatedParty: [{
                        id: 'cust',
                        role: 'customer'
                    }],
                    orderItem: [{
                        id: '1',
                        product: {
                            relatedParty: [{
                                id: 'test',
                                role: 'Customer'
                            }]
                        },
                        productOffering: {
                            href: ''
                        }
                    }]
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail when the customer is trying to acquire one of his offerings', function (done) {
                var SERVER = 'http://example.com';
                var productOfferingPath = '/productOffering/1';
                var productSpecPath = '/product/2';

                var user = {
                    id: 'example'
                };

                var expected = {
                    status: 403,
                    message: 'You cannot acquire your own offering'
                };

                var body = {
                    relatedParty: [{
                        id: 'example',
                        role: 'customer'
                    }],
                    orderItem: [{
                        id: '1',
                        product: {
                            relatedParty: [{
                                id: 'example',
                                role: 'Customer'
                            }]
                        },
                        productOffering: {
                            href: SERVER + productOfferingPath
                        }
                    }]
                };

                nock(CATALOG_SERVER)
                    .get(productOfferingPath)
                    .reply(200, {productSpecification: {href: SERVER + productSpecPath}});

                nock(CATALOG_SERVER)
                    .get(productSpecPath)
                    .reply(200, {relatedParty: [{role: 'owner', id: 'example'}]});

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });
        });


        //////////////////////////////////////////////////////////////////////////////////////////////
        /////////////////////////////////////////// UPDATE ///////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        describe('Update (PATCH)', function() {

            it('should fail when the body is invalid', function (done) {

                var utils = {
                    validateLoggedIn: validateLoggedOk
                };

                var orderingApi = getOrderingAPI({}, {}, utils);

                var req = {
                    method: 'PATCH',
                    body: '{ invalid JSON'
                };

                orderingApi.checkPermissions(req, function (err) {
                    expect(err).toEqual({
                        status: 400,
                        message: 'The resource is not a valid JSON document'
                    });

                    done();
                });

            });

            it('should fail when the ordering cannot be retrieved', function (done) {

                var SERVER = 'http://example.com:189';
                var productOfferingPath = '/productOrdering/ordering/7';

                var orderingApi = getOrderingAPI({}, {}, {});

                var user = {
                    id: 'fiware',
                    href: 'http://www.fiware.org/user/fiware'
                };

                var req = {
                    user: user,
                    method: 'PATCH',
                    body: JSON.stringify({}),
                    apiUrl: productOfferingPath
                };

                nock(SERVER)
                    .get(productOfferingPath)
                    .reply(500, {});

                orderingApi.checkPermissions(req, function (err) {

                    expect(err).toEqual({
                        status: 400,
                        message: 'The requested ordering cannot be retrieved'
                    });

                    done();
                });
            });

            var testUpdate = function (hasRoleResponses, body, previousState, previousOrderItems, previousNotes,
                                       refundError, expectedError, expectedBody, done) {

                var user = {
                    id: 'fiware',
                    href: 'http://www.fiware.org/user/fiware'
                };

                var orderId = 7;
                var SERVER = 'http://example.com:189';
                var productOfferingPath = '/productOrdering/ordering/7';

                var tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole']);
                tmfUtils.hasPartyRole.and.returnValues.apply(tmfUtils.hasPartyRole, hasRoleResponses);

                var utils = jasmine.createSpyObj('utils', ['updateBody']);
                utils.validateLoggedIn = validateLoggedOk;

                var storeClient = {
                    storeClient: {
                        refund: function (receivedOrderId, receivedUser, callback) {
                            expect(receivedOrderId).toBe(orderId);
                            expect(receivedUser).toBe(user);
                            callback(refundError);
                        }
                    }
                };

                var orderingApi = getOrderingAPI(storeClient, tmfUtils, utils);

                var req = {
                    user: user,
                    method: 'PATCH',
                    body: JSON.stringify(body),
                    apiUrl: productOfferingPath
                };

                var orderingRelatedParties = [{}, {}];

                nock(SERVER)
                    .get(productOfferingPath)
                    .reply(200, {
                        id: orderId,
                        state: previousState,
                        relatedParty: orderingRelatedParties,
                        orderItem: previousOrderItems,
                        note: previousNotes
                    });

                orderingApi.checkPermissions(req, function (err) {

                    expect(err).toEqual(expectedError);

                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, jasmine.arrayContaining(orderingRelatedParties), 'Customer');
                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, jasmine.arrayContaining(orderingRelatedParties), 'Seller');

                    if (expectedBody) {
                        expect(utils.updateBody).toHaveBeenCalledWith(req, expectedBody);
                    }

                    done();
                });

            };

            it('should fail when seller tries to update a non in progress ordering', function(done) {

                var previousState = 'Acknowledged';

                var expectedError = {
                    status: 403,
                    message: previousState + ' orders cannot be manually modified'
                };

                testUpdate([false, true], {orderItem: []}, previousState, [], [], null, expectedError, null, done);

            });

            it('should not fail when customer tries to update a non in progress ordering', function(done) {
                var previousState = 'Acknowledged';
                testUpdate([true, false], {description: 'New Description'}, previousState, [], [], null, null, null, done);
            });

            it('should fail when the user is not consumer or seller in the ordering', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'You are not authorized to modify this ordering'
                };

                testUpdate([false, false], {}, 'InProgress', [], [], null, expectedError, null, done);
            });

            it('should fail when a customer tries to modify the orderItem field', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'Order items can only be modified by sellers'
                };

                testUpdate([true, false], {orderItem: []}, 'InProgress', [], [], null, expectedError, null, done);
            });

            it('should fail when a customer tries to modify the relatedParty field', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'Related parties cannot be modified'
                };

                testUpdate([true, false], {relatedParty: []}, 'InProgress', [], [], null, expectedError, null, done);
            });

            it('should not fail when a customer tries to modify the description', function (done) {
                testUpdate([true, false], {description: 'New description'}, 'InProgress', [], [], null, null, null, done);
            });

            it('should fail when a customer tries to modify the order state to an invalid state', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'Invalid order state. Valid states for customers are: "Cancelled"'
                };

                testUpdate([true, false], {state: 'Completed'}, 'InProgress', [{state: 'Completed'}], [],
                    null, expectedError, null, done);
            });

            it('should fail when a customer tries to cancel an ordering with completed items', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'Orderings can only be cancelled when all Order items are in Acknowledged state'
                };

                testUpdate([true, false], {state: 'Cancelled'}, 'InProgress', [{state: 'Completed'}], [],
                    null, expectedError, null, done);
            });

            it('should fail when a customer tries to cancel an ordering with failed items', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'Orderings can only be cancelled when all Order items are in Acknowledged state'
                };

                testUpdate([true, false], {state: 'Cancelled'}, 'InProgress', [{state: 'Failed'}], [],
                    null, expectedError, null, done);
            });

            it('should fail when a customer tries to cancel an ordering with cancelled items', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'Orderings can only be cancelled when all Order items are in Acknowledged state'
                };

                testUpdate([true, false], {state: 'Cancelled'}, 'InProgress', [{state: 'Cancelled'}], [],
                    null, expectedError, null, done);
            });

            it('should fail when refund cannot be completed', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'You cannot cancel orders with completed items'
                };

                testUpdate([true, false], {state: 'Cancelled'}, 'InProgress', [], [], expectedError,
                    expectedError, null, done);
            });

            it('should not fail when refund can be completed', function (done) {

                var previousItems = [
                    {state: 'Acknowledged', id: 7},
                    {state: 'Acknowledged', id: 9}
                ];

                var requestBody = {
                    state: 'Cancelled',
                    description: 'I do not need this items anymore'
                };

                var expectedItems = JSON.parse(JSON.stringify(previousItems));
                expectedItems.forEach(function (item) {
                    item.state = 'Cancelled';
                });

                var expectedBody = JSON.parse(JSON.stringify(requestBody));
                expectedBody.orderItem = expectedItems;

                testUpdate([true, false], requestBody, 'InProgress', previousItems, [], null, null, expectedBody, done);
            });

            it('should fail when a seller tries to modify the description', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'Sellers can only modify order items or include notes'
                };

                testUpdate([false, true], {
                    description: 'New description',
                    orderItem: []
                }, 'InProgress', [], [], null, expectedError, null, done);
            });

            it('should not fail when seller does not include any order item', function (done) {

                var previousOrderItems = [{id: 1, state: 'InProgress'}];
                testUpdate([false, true], {orderItem: []}, 'InProgress', previousOrderItems, [], null, null,
                    {orderItem: previousOrderItems}, done);
            });

            it('should fail when the seller tries to edit a non existing item', function (done) {

                var previousOrderItems = [{id: 1, state: 'InProgress'}];
                var updatedOrderings = {
                    orderItem: [{id: 2}]
                };

                var expectedError = {
                    status: 400,
                    message: 'You are trying to edit an non-existing item'
                };

                testUpdate([false, true], updatedOrderings, 'InProgress', previousOrderItems, [],
                    null, expectedError, null, done);
            });

            it('should fail when the seller tries to edit a non owned item', function (done) {

                var previousOrderItems = [{id: 1, state: 'InProgress', product: {relatedParty: []}}];
                var updatedOrderings = {
                    orderItem: [{id: 1, state: 'Completed', product: {relatedParty: []}}]
                };

                var expectedError = {
                    status: 403,
                    message: 'You cannot modify an order item if you are not seller'
                };

                testUpdate([false, true, false], updatedOrderings, 'InProgress', previousOrderItems, [],
                    null, expectedError, null, done);
            });

            it('should fail when the seller tries to add a new field to the item', function (done) {

                var previousOrderItems = [{id: 1, state: 'InProgress', product: {relatedParty: []}}];
                var updatedOrderings = {
                    orderItem: [{id: 1, name: 'Order Item', state: 'InProgress', product: {relatedParty: []}}]
                };

                var expectedError = {
                    status: 403,
                    message: 'The fields of an order item cannot be modified'
                };

                testUpdate([false, true, true], updatedOrderings, 'InProgress', previousOrderItems, [],
                    null, expectedError, null, done);
            });

            it('should fail when the seller tries to remove a field from the item', function (done) {

                var previousOrderItems = [{
                    id: 1,
                    name: 'Order Item',
                    state: 'InProgress',
                    product: {relatedParty: []}
                }];
                var updatedOrderings = {
                    orderItem: [{id: 1, state: 'InProgress', product: {relatedParty: []}}]
                };

                var expectedError = {
                    status: 403,
                    message: 'The fields of an order item cannot be modified'
                };

                testUpdate([false, true, true], updatedOrderings, 'InProgress', previousOrderItems, [],
                    null, expectedError, null, done);
            });

            it('should fail when the seller tries to modify the value of a field in the item', function (done) {

                var previousOrderItems = [{
                    id: 1,
                    name: 'Order Item',
                    state: 'InProgress',
                    product: {relatedParty: []}
                }];
                var updatedOrderings = {
                    orderItem: [{id: 1, name: 'Order Item #2', state: 'InProgress', product: {relatedParty: []}}]
                };

                var expectedError = {
                    status: 403,
                    message: 'The value of the field name cannot be changed'
                };

                testUpdate([false, true, true], updatedOrderings, 'InProgress', previousOrderItems, [],
                    null, expectedError, null, done);
            });

            it('should not fail when the user tries to modify the state of an item appropriately', function (done) {

                var previousOrderItems = [{id: 1, state: 'InProgress', product: {relatedParty: []}}];
                var updatedOrderings = {
                    orderItem: [{id: 1, state: 'Completed', product: {relatedParty: []}}]
                };

                var expectedBody = {
                    orderItem: updatedOrderings.orderItem
                };

                testUpdate([false, true, true], updatedOrderings, 'InProgress', previousOrderItems, [],
                    null, null, expectedBody, done);
            });

            // FIXME: Maybe this test can be skipped
            it('should fail when the seller tries to edit a non existing item when there are more than one item', function (done) {

                var previousOrderItems = [{id: 1, state: 'InProgress'}, {id: 3, state: 'InProgress'}];
                var updatedOrderings = {
                    orderItem: [{id: 2}]
                };

                var expectedError = {
                    status: 400,
                    message: 'You are trying to edit an non-existing item'
                };

                testUpdate([false, true], updatedOrderings, 'InProgress', previousOrderItems, [],
                    null, expectedError, null, done);
            });

            it('should include the items that belong to another sellers', function (done) {

                var previousOrderItems = [
                    {id: 1, state: 'InProgress', name: 'Product1', product: {relatedParty: []}},
                    {id: 2, state: 'InProgress', name: 'Product2', product: {relatedParty: []}}
                ];
                var updatedOrderings = {
                    orderItem: [
                        {id: 1, state: 'Completed', name: 'Product1', product: {relatedParty: []}}
                    ]
                };

                var expectedOrderItems = JSON.parse(JSON.stringify(previousOrderItems));
                expectedOrderItems.forEach(function (item) {

                    var updateOrderItem = updatedOrderings.orderItem.filter(function (updatedItem) {
                        return item.id == updatedItem.id;
                    })[0];

                    if (updateOrderItem) {
                        item.state = updateOrderItem.state;
                    }
                });

                var expectedBody = {
                    orderItem: expectedOrderItems
                };

                testUpdate([false, true, true], updatedOrderings, 'InProgress', previousOrderItems, [],
                    null, null, expectedBody, done);

            });

            it('should allow a customer to include a new note when none previously included', function (done) {
                var notesBody = {
                    note: [{
                        text: 'Some text'
                    }]
                };
                testUpdate([true, false], notesBody, 'InProgress', [], [], null, null, null, done);
            });

            it('should allow a customer to include a new note to the existing ones', function(done) {
                var notesBody = {
                    note: [{
                        text: 'Some text',
                        author: 'testuser'
                    }, {
                        text: 'New note',
                        author: 'testuser'
                    }]
                };

                var prevNotes = [{
                    text: 'Some text',
                    author: 'testuser'
                }];

                testUpdate([true, false], notesBody, 'InProgress', [], prevNotes, null, null, null, done);
            });

            it('should fail when the customer tries to modify already existing notes', function(done) {
                var notesBody = {
                    note: [{
                        text: 'New note',
                        author: 'testuser'
                    }]
                };

                var prevNotes = [{
                    text: 'Some text',
                    author: 'testuser'
                }];

                testUpdate([true, false], notesBody, 'InProgress', [], prevNotes, null, {
                    status: 403,
                    message: 'You are not allowed to modify the existing notes of an ordering'
                }, null, done);
            });

            it('should allow a seller to include a new note', function(done) {
                var notesBody = {
                    note: [{
                        text: 'Some text'
                    }]
                };
                testUpdate([false, true], notesBody, 'InProgress', [], [], null, null, null, done);
            });
        });
    });


    describe('Post Validation', function() {

        //////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////// NOTIFY STORE ////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        var getBaseUser = function() {
            return { id: 'test' }
        };

        var getBaseOrdering = function(billingAccountPath) {
            return {
                a: 'a',
                orderItem: [
                    {
                        billingAccount: [{
                            id: 7,
                            href: BILLING_SERVER + billingAccountPath
                        }]
                    }
                ]
            };
        };

        var testPostValidation = function (ordering, userInfo, storeClient, headers, getBillingReq, updateBillingReq, checker) {

            var orderingApi = getOrderingAPI({ storeClient: storeClient }, {}, {});

            var req = {
                method: 'POST',
                user: userInfo,
                body: JSON.stringify(ordering),
                headers: headers
            };

            if (getBillingReq) {
                nock(BILLING_SERVER)
                    .get(getBillingReq.path)
                    .reply(getBillingReq.status, getBillingReq.body);
            }

            if (updateBillingReq) {
                nock(BILLING_SERVER)
                    .patch(updateBillingReq.path, updateBillingReq.expectedBody)
                    .reply(updateBillingReq.status);
            }

            orderingApi.executePostValidation(req, checker);
        };

        var testPostValidationStoreNotifyOk = function(repeatedUser, getBillingFails, updateBillingFails, err, done) {

            var buildUser = function(userName) {
                return {
                    id: userName,
                    href: 'http://example.com/user/' + userName
                }
            };

            var headers = {};
            var billingAccountPath = '/billingAccount/7';
            var ordering = getBaseOrdering(billingAccountPath);
            var user = getBaseUser();

            var user1 = buildUser('user1');
            var user2 = buildUser('user2');
            ordering.relatedParty = [ user1, user2 ];

            var getBillingReq = {
                status: getBillingFails ? 500 : 200,
                path: billingAccountPath,
                body: {
                    relatedParty: []
                }
            };

            var billingUser1 = buildUser(user1.id);
            var billingUser2 = buildUser(user2.id);
            billingUser1.role = 'bill responsible';
            billingUser2.role = 'bill responsible';

            if (repeatedUser) {
                // If the user is repeated, we have to push it in the list
                // of users returned by the billing API
                getBillingReq.body.relatedParty.push(user1);

                // When the user is repeated, its role is not changed
                delete billingUser1.role;
            }

            var updateBillingReq = {
                status: updateBillingFails ? 500 : 200,
                path: billingAccountPath,
                expectedBody: {
                    relatedParty: [billingUser1, billingUser2]
                }
            };

            var redirectUrl = 'http://fakepaypal.com';
            var storeClient = jasmine.createSpyObj('storeClient', ['notifyOrder']);
            storeClient.notifyOrder.and.callFake(function(orderInfo, userInfo, callback) {
                callback(null, {
                    body: JSON.stringify({redirectUrl: redirectUrl })
                })
            });

            testPostValidation(ordering, user, storeClient, headers, getBillingReq, updateBillingReq, function (err) {
                expect(err).toEqual(err);
                expect(headers).toEqual({'X-Redirect-URL': redirectUrl});
                expect(storeClient.notifyOrder).toHaveBeenCalledWith(ordering, user, jasmine.any(Function));
                done();
            });
        };

        it('should return extra headers and push all users into the billing account', function (done) {
            testPostValidationStoreNotifyOk(false, false, false, null, done);
        });

        it('should not insert repeated users in the billing account', function(done) {
            testPostValidationStoreNotifyOk(true, false, false, null, done);
        });

        it('should fail when the billing account cannot be retrieved', function(done) {
            testPostValidationStoreNotifyOk(false, true, false, {
                status: 500,
                message: 'Unexpected error when checking the given billing account'
            }, done);
        });

        it('should fail when the billing account cannot be updated', function(done) {

            testPostValidationStoreNotifyOk(false, false, true, {
                status: 500,
                message: 'Unexpected error when updating the given billing account'
            }, done);
        });

        it('should fail when store fails at the time of registering the ordering', function (done) {

            var headers = {};
            var ordering = getBaseOrdering('/billing/9');
            var user = getBaseUser();

            var storeClient = jasmine.createSpyObj('storeClient', ['notifyOrder']);
            storeClient.notifyOrder.and.callFake(function(orderInfo, userInfo, callback) {
                callback({status: 500});
            });

            testPostValidation(ordering, user, storeClient, {}, null, null, function (err) {

                expect(err).toEqual({status: 500});
                expect(headers).toEqual({});
                expect(storeClient.notifyOrder).toHaveBeenCalledWith(ordering, user, jasmine.any(Function));

                done();
            });
        });

        it('should directly call the callback when the request method is not GET or POST', function (done) {

            var req = {
                method: 'DELETE'
            };

            var orderingApi = getOrderingAPI({}, {}, {});

            orderingApi.executePostValidation(req, function (err) {
                expect(err).toBe(null);
                done();
            });
        });

        //////////////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////// FILTER ORDERINGS //////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        it('should fail if the ordering does not belong to the user', function(done) {

            var tmfUtils = {
                hasPartyRole: function() {
                    return false;
                }
            };

            var req = {
                method: 'GET',
                body: '{}'
            };

            var orderingApi = getOrderingAPI({}, tmfUtils, {});

            orderingApi.executePostValidation(req, function(err) {
                expect(err).toEqual({
                    status: 403,
                    message: 'You are not authorized to retrieve the specified ordering'
                });

                done();
            });
        });

        var testFilterOrders = function(orders, done) {

            var user = { id: 'fiware' };

            // Not consumer but seller
            var hasRolesReturnValues =  [];
            orders.map(function(order) {
                hasRolesReturnValues.push(order.isInvolved);
                hasRolesReturnValues.push(order.isInvolved);
            });

            var tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole']);
            tmfUtils.hasPartyRole.and.returnValues.apply(tmfUtils.hasPartyRole, hasRolesReturnValues);

            var utils = {};
            utils.updateBody = function(req, newBody) {

                var expectedOrderItem = [];

                orders.forEach(function(order) {
                    if (order.isInvolved) {
                        expectedOrderItem.push(order.item);
                    }
                });

                expect(newBody).toEqual(expectedOrderItem);
            };

            var body = orders.map(function(order) {
                return order.item;
            });

            var req = {
                method: 'GET',
                body: JSON.stringify(body),
                user: user
            };

            var orderingApi = getOrderingAPI({}, tmfUtils, utils);

            orderingApi.executePostValidation(req, function(err) {

                expect(err).toBe(null);

                orders.forEach(function(order) {
                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, order.item.relatedParty, 'Customer');
                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, order.item.relatedParty, 'Seller');
                });

                expect(tmfUtils.hasPartyRole.calls.count()).toBe(orders.length * 2); // One for customer and one for seller

                done();
            });
        };

        it('should not filter the ordering as the user is involved in', function(done) {

            var order = { item: { orderItems: [ {}, {}, {} ], note: [] }, isInvolved: true };
            testFilterOrders([order], done);
        });

        it('should filter the ordering as the user is not involved in', function(done) {

            var order = { item: { orderItems: [ {}, {}, {} ] }, isInvolved: false };
            testFilterOrders([order], done);
        });

        it('should filter just one ordering as the user is involved in the other one', function(done) {

            var order1 = { item: { orderItems: [ {}, {}, {} ] }, isInvolved: false };
            var order2 = { item: { orderItems: [ {}, {}, {} ], note: [] }, isInvolved: true };
            testFilterOrders([ order1, order2 ], done);
        });

        it('should not filter orderings as the user is involved in both', function(done) {

            var order1 = { item: { orderItems: [ {}, {}, {} ], note: [] }, isInvolved: true };
            var order2 = { item: { orderItems: [ {}, {}, {} ], note: [] }, isInvolved: true };
            testFilterOrders([ order1, order2 ], done);
        });


        it('should filter all the orderings as the user is not involved in either of them', function(done) {

            var order1 = { item: { orderItems: [ {}, {}, {} ] }, isInvolved: false };
            var order2 = { item: { orderItems: [ {}, {}, {} ] }, isInvolved: false };
            testFilterOrders([ order1, order2 ], done);
        });

        var notFilterItemsUserIsCustomer = function(method, done) {
            var user = { id: 'fiware' };
            var orderingRelatedParties =  [ {id: 'fiware'} ];
            var originalBody = {
                relatedParty: orderingRelatedParties,
                note: [],
                orderItem: [ { product: { relatedParty: [{ id: 'fiware', role: 'customer' }], id: 7 } } ]
            };
            var expectedBody = JSON.parse(JSON.stringify(originalBody));

            var tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole']);
            tmfUtils.hasPartyRole.and.returnValues.apply(tmfUtils.hasPartyRole, [true, false]);

            var utils = {};
            utils.updateBody = function(req, newBody) {
                expect(newBody).toEqual(expectedBody);
            };

            var req = {
                method: method,
                body: JSON.stringify(originalBody),
                user: user
            };

            var orderingApi = getOrderingAPI({}, tmfUtils, utils);

            orderingApi.executePostValidation(req, function(err) {
                expect(err).toEqual(null);
                expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, orderingRelatedParties, 'Customer');
                expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, orderingRelatedParties, 'Seller');
                expect(tmfUtils.hasPartyRole.calls.count()).toBe(2);

                done();
            });
        };

        it('should not fail and not filter items when the user is customer (GET)', function(done) {
            notFilterItemsUserIsCustomer('GET', done);
        });

        it('should not fail and not filter items when the user is customer (PUT)', function(done) {
            notFilterItemsUserIsCustomer('PUT', done);
        });

        it('should not fail and not filter items when the user is customer (PATCH)', function(done) {
            notFilterItemsUserIsCustomer('PATCH', done);
        });

        var testSeller = function(orderItems, method, done) {

            var user = { id: 'fiware' };
            var orderingRelatedParties = [];
            var originalBody = { relatedParty: orderingRelatedParties, orderItem: [], note: [] };

            orderItems.forEach(function(item) {
                originalBody.orderItem.push(item.item);
            });

            // Not consumer but seller
            var hasRolesReturnValues = [false, true];
            orderItems.forEach(function(item) {
               hasRolesReturnValues.push(item.isSeller);
            });

            var tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole']);
            tmfUtils.hasPartyRole.and.returnValues.apply(tmfUtils.hasPartyRole, hasRolesReturnValues);

            var utils = {};
            utils.updateBody = function(req, newBody) {

                var expectedOrderItem = [];

                orderItems.forEach(function(item) {
                    if (item.isSeller) {
                       expectedOrderItem.push(item.item);
                    }
                });

                expect(newBody).toEqual({ relatedParty: orderingRelatedParties, orderItem: expectedOrderItem, note: [] });
            };

            var req = {
                method: method,
                // The body returned by the server...
                body: JSON.stringify(originalBody),
                user: user
            };

            var orderingApi = getOrderingAPI({}, tmfUtils, utils);

            orderingApi.executePostValidation(req, function(err) {

                expect(err).toEqual(null);

                expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, orderingRelatedParties, 'Customer');
                expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, orderingRelatedParties, 'Seller');

                orderItems.forEach(function(item) {
                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, item.item.product.relatedParty, 'Seller');
                });

                done();
            });
        };

        var notFilterSingleItem = function(method, done) {
            var orderItemRelatedParties = [{ id: 'fiware', role: 'seller' }];
            var orderItem =  { item: { product: { relatedParty: orderItemRelatedParties, id: 7 } }, isSeller: true };

            testSeller([orderItem], method, done);
        };

        it('should not fail and not filter the only item (GET)', function(done) {
            notFilterSingleItem('GET', done);
        });

        it('should not fail and not filter the only item (PUT)', function(done) {
            notFilterSingleItem('PUT', done);
        });

        it('should not fail and not filter the only item (PATCH)', function(done) {
            notFilterSingleItem('PATCH', done);
        });

        var filterSingleElement = function(method, done) {
            var orderItemRelatedParties = [{ id: 'other-seller', role: 'seller' }];
            var orderItem =  { item: { product: { relatedParty: orderItemRelatedParties, id: 7 } }, isSeller: false };

            testSeller([orderItem], method, done);
        };

        it('should not fail and filter the only item (GET)', function(done) {
            filterSingleElement('GET', done);
        });

        it('should not fail and filter the only item (PUT)', function(done) {
            filterSingleElement('PUT', done);
        });

        it('should not fail and filter the only item (PATCH)', function(done) {
            filterSingleElement('PATCH', done);
        });

        var filterOneItem = function(method, done) {

            var orderItem1RelatedParties = [{ id: 'other-seller', role: 'seller' }];
            var orderItem2RelatedParties = [{ id: 'fiware', role: 'seller' }];
            var orderItem1 = { item: { product: { relatedParty: orderItem1RelatedParties, id: 7 } }, isSeller: false };
            var orderItem2 = { item: { product: { relatedParty: orderItem2RelatedParties, id: 8 } }, isSeller: true };


            testSeller([orderItem1, orderItem2], method, done);
        };

        it('should not fail and filter one order item (GET)', function(done) {
            filterOneItem('GET', done);
        });

        it('should not fail and filter one order item (PUT)', function(done) {
            filterOneItem('PUT', done);
        });

        it('should not fail and filter one order item (PATCH)', function(done) {
            filterOneItem('PATCH', done);
        });

        var notFilterItems = function(method, done) {
            var orderItemRelatedParties = [{ id: 'fiware', role: 'seller' }];
            var orderItem1 = { item: { product: { relatedParty: orderItemRelatedParties, id: 7 } }, isSeller: true };
            var orderItem2 = { item: { product: { relatedParty: orderItemRelatedParties, id: 8 } }, isSeller: true };


            testSeller([orderItem1, orderItem2], method, done);
        };

        it('should not fail and not filter items (GET)', function(done) {
            notFilterItems('GET', done);
        });

        it('should not fail and not filter items (PUT)', function(done) {
            notFilterItems('PUT', done);
        });

        it('should not fail and not filter items (PATCH)', function(done) {
            notFilterItems('PATCH', done);
        });

        var filterTwoItems = function(method, done) {
            var nowOwnerRelatedParties = [{ id: 'other-seller', role: 'seller' }];
            var ownerRelatedParties = [{ id: 'fiware', role: 'seller' }];
            var orderItem1 = { item: { product: { relatedParty: nowOwnerRelatedParties, id: 7 } }, isSeller: false };
            var orderItem2 = { item: { product: { relatedParty: ownerRelatedParties, id: 8 } }, isSeller: false };
            var orderItem3 = { item: { product: { relatedParty: ownerRelatedParties, id: 9 } }, isSeller: true };


            testSeller([orderItem1, orderItem2, orderItem3], method, done);
        };

        it('should not fail and filter two order items (GET)', function(done) {
            filterTwoItems('GET', done);
        });

        it('should not fail and filter two order items (PUT)', function(done) {
            filterTwoItems('PUT', done);
        });

        it('should not fail and filter two order items (PATCH)', function(done) {
            filterTwoItems('PATCH', done);
        });
    });
});
