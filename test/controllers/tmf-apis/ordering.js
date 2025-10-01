/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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

const nock = require('nock');
const proxyquire = require('proxyquire');
const testUtils = require('../../utils');

describe('Ordering API', function() {
    const config = testUtils.getDefaultConfig();

    const SERVER =
        (config.endpoints.ordering.appSsl ? 'https' : 'http') +
        '://' +
        config.endpoints.ordering.host +
        ':' +
        config.endpoints.ordering.port;
    const CATALOG_SERVER =
        (config.endpoints.catalog.appSsl ? 'https' : 'http') +
        '://' +
        config.endpoints.catalog.host +
        ':' +
        config.endpoints.catalog.port;
    const B_ACCOUNT_SERVER =
        (config.endpoints.account.appSsl ? 'https' : 'http') +
        '://' +
        config.endpoints.account.host +
        ':' +
        config.endpoints.account.port;

    // Errors
    const BILLING_ACCOUNT_REQUIRED = {
        status: 422,
        message: 'Billing Account is required'
    };

    const BILLING_ACCOUNTS_MISMATCH = {
        status: 422,
        message: 'Billing Accounts must be the same for all the order items contained in the ordering'
    };

    const getOrderingAPI = function(storeClient, tmfUtils, utils) {

        return proxyquire('../../../controllers/tmf-apis/ordering', {
            './../../config': config,
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/store': storeClient,
            './../../lib/tmfUtils': tmfUtils,
            './../../lib/utils': utils
        }).ordering;
    };

    const validateLoggedOk = function(req, callback) {
        callback();
    };

    const getIndividualURL = function(user) {
        return 'http://belp.fiware.org:7891/party/api/partyManagement/v2/individual/' + (user || '');
    };

    beforeEach(function() {
        nock.cleanAll();
    });

    describe('Get Permissions', function() {
        /// ///////////////////////////////////////////////////////////////////////////////////////////
        /// /////////////////////////////////// NOT AUTHENTICATED /////////////////////////////////////
        /// ///////////////////////////////////////////////////////////////////////////////////////////

        describe('Not Authenticated Requests', function() {
            const validateLoggedError = function(req, callback) {
                callback({
                    status: 401,
                    message: 'You need to be authenticated to create/update/delete resources'
                });
            };

            const testNotLoggedIn = function(method, done) {
                const utils = {
                    validateLoggedIn: validateLoggedError
                };

                const orderingApi = getOrderingAPI({}, {}, utils);
                const path = '/ordering';

                // Call the method
                const req = {
                    method: method,
                    url: path
                };

                orderingApi.checkPermissions(req, function(err) {
                    expect(err).not.toBe(null);
                    expect(err.status).toBe(401);
                    expect(err.message).toBe('You need to be authenticated to create/update/delete resources');

                    done();
                });
            };

            it('should reject not authenticated GET requests', function(done) {
                testNotLoggedIn('GET', done);
            });

            it('should reject not authenticated POST requests', function(done) {
                testNotLoggedIn('POST', done);
            });

            it('should reject not authenticated PATCH requests', function(done) {
                testNotLoggedIn('PATCH', done);
            });
        });

        /// ///////////////////////////////////////////////////////////////////////////////////////////
        /// ////////////////////////////////////// NOT ALLOWED ////////////////////////////////////////
        /// ///////////////////////////////////////////////////////////////////////////////////////////

        describe('Not allowed methods', function() {
            const methodNotAllowedStatus = 405;
            const methodNotAllowedMessage = 'This method used is not allowed in the accessed API';

            const methodNotAllowed = function(req, callback) {
                callback({
                    status: methodNotAllowedStatus,
                    message: methodNotAllowedMessage
                });
            };

            const testMethodNotAllowed = function(method, done) {
                const utils = {
                    methodNotAllowed: methodNotAllowed
                };

                const orderingApi = getOrderingAPI({}, {}, utils);
                const path = '/ordering';

                // Call the method
                const req = {
                    method: method,
                    url: path
                };

                orderingApi.checkPermissions(req, function(err) {
                    expect(err).not.toBe(null);
                    expect(err.status).toBe(methodNotAllowedStatus);
                    expect(err.message).toBe(methodNotAllowedMessage);

                    done();
                });
            };

            it('should reject not authenticated PUT requests', function(done) {
                testMethodNotAllowed('PUT', done);
            });

            it('should reject not authenticated DELETE requests', function(done) {
                testMethodNotAllowed('DELETE', done);
            });
        });

        /// ///////////////////////////////////////////////////////////////////////////////////////////
        /// ////////////////////////////////////// RETRIEVAL //////////////////////////////////////////
        /// ///////////////////////////////////////////////////////////////////////////////////////////

        describe('GET', function() {
            const testRetrieval = function(filterRelatedPartyFields, expectedErr, done) {
                let ensureRelatedPartyIncludedCalled = false;

                const tmfUtils = {
                    filterRelatedPartyWithRole: filterRelatedPartyFields,

                    ensureRelatedPartyIncluded: function(req, callback) {
                        ensureRelatedPartyIncludedCalled = true;
                        callback(null);
                    }
                };

                const utils = {
                    validateLoggedIn: function(req, callback) {
                        callback(null);
                    }
                };

                const req = {
                    method: 'GET'
                };

                const orderingApi = getOrderingAPI({}, tmfUtils, utils);

                orderingApi.checkPermissions(req, function(err) {
                    expect(ensureRelatedPartyIncludedCalled).toBe(true);
                    expect(err).toEqual(expectedErr);

                    done();
                });
            };

            it('should call callback with error when retrieving list of orderings and using invalid filters', function(done) {
                const error = {
                    status: 401,
                    message: 'Invalid filters'
                };

                const filterRelatedPartyFields = function(req, allowedRoles, callback) {
                    callback(error);
                };

                testRetrieval(filterRelatedPartyFields, error, done);
            });

            it('should call callback without errors when user is allowed to retrieve the list of orderings', function(done) {
                const filterRelatedPartyFields = function(req, allowedRoles, callback) {
                    callback();
                };

                testRetrieval(filterRelatedPartyFields, null, done);
            });
        });


        /// ///////////////////////////////////////////////////////////////////////////////////////////
        /// /////////////////////////////////////// CREATION //////////////////////////////////////////
        /// ///////////////////////////////////////////////////////////////////////////////////////////

        describe('Creation', function() {
            const testOrderCreation = function(
                userInfo,
                body,
                customerRoleRequired,
                isCustomer,
                hasPartyRole,
                expectedRes,
                done,
                checkReq
            ) {
                config.customerRoleRequired = customerRoleRequired;

                const utils = {
                    validateLoggedIn: validateLoggedOk,
                    hasRole: function() {
                        return isCustomer;
                    }
                };

                const tmfUtils = jasmine.createSpyObj('tmfUtils', ['getIndividualURL', 'hasPartyRole']);
                tmfUtils.getIndividualURL.and.returnValue(getIndividualURL(userInfo.partyId));
                tmfUtils.hasPartyRole.and.returnValue(hasPartyRole);

                const orderingApi = getOrderingAPI({}, tmfUtils, utils);

                const req = {
                    user: userInfo,
                    method: 'POST',
                    body: body,
                    headers: {}
                };

                orderingApi.checkPermissions(req, function(err) {
                    expect(err).toEqual(expectedRes);

                    if (checkReq) {
                        checkReq(req);
                    }

                    done();
                });
            };

            const testValidOrdering = function(nOrderItems, isCustomer, customerRoleRequired, isBundle, done) {
                const userName = 'example';
                const billingAccountPath = '/api/billingAccount/7';
                const productOfferingBundlePath = '/api/productOffering/2';
                const productOfferingPath = '/api/productOffering/1';
                const productSpecPath = '/api/productSpecification/2';
                const ownerName = 'ownerUser';

                const user = {
                    partyId: userName
                };

                const orderItems = [];

                for (let i = 0; i < nOrderItems; i++) {
                    const offeringPath = !isBundle ? productOfferingPath : productOfferingBundlePath;
                    orderItems.push({
                        product: {},
                        productOffering: {
                            id: 1,
                            href: 'http://extexample.com' + offeringPath
                        }
                    });
                }

                const body = {
                    relatedParty: [
                        {
                            id: userName,
                            role: 'customer'
                        }
                    ],
                    productOrderItem: orderItems,
                    billingAccount: {
                        id: 7,
                        href: B_ACCOUNT_SERVER + billingAccountPath
                    }
                };

                nock(CATALOG_SERVER)
                    .get(productOfferingBundlePath)
                    .times(nOrderItems)
                    .reply(200, { isBundle: true, bundledProductOffering: [{href: SERVER + productOfferingPath }] });

                nock(CATALOG_SERVER)
                    .get(productOfferingPath)
                    .times(nOrderItems)
                    .reply(200, { productSpecification: { id: 2, href: SERVER + productSpecPath } });

                nock(CATALOG_SERVER)
                    .get(productSpecPath)
                    .times(nOrderItems)
                    .reply(200, { relatedParty: [{ id: ownerName, role: 'owner' }] });

                nock(B_ACCOUNT_SERVER)
                    .get(billingAccountPath)
                    .reply(200, { relatedParty: [{ id: userName, role: config.billingAccountOwnerRole }] });

                testOrderCreation(
                    user,
                    JSON.stringify(body),
                    customerRoleRequired,
                    isCustomer,
                    true,
                    null,
                    done,
                    function(req) {
                        const newBody = JSON.parse(req.body);
                        // expect(req.headers['content-length']).toBe(newBody.length);

                        expect(newBody.productOrderItem[0].product.relatedParty).toEqual([
                            {
                                id: userName,
                                role: 'Customer',
                                href: getIndividualURL(userName)
                            },
                            {
                                id: ownerName,
                                role: 'Seller',
                                href: ownerName
                            }
                        ]);
                    }
                );
            };

            it('should call the callback after validating the request when the user is not customer but customer role not required', function(done) {
                testValidOrdering(1, false, false, false, done);
            });

            it('should call the callback after validating the request when the user is customer (1 order item)', function(done) {
                testValidOrdering(1, true, true, false, done);
            });

            it('should call the callback after validating the request when the user is customer (2 order items)', function(done) {
                testValidOrdering(2, true, true, false, done);
            });

            it('should call the callback after validating the request when the offering is a bundle', function(done) {
                testValidOrdering(1, true, true, true, done);
            });

            it('should fail if the order does not include a billing account', (done) => {
                const productOfferingPath = '/api/productOffering/1';
                const productSpecPath = '/api/productSpecification/2';
                const userName = 'example'

                const user = {
                    partyId: userName
                };

                const body = {
                    relatedParty: [
                        {
                            id: userName,
                            role: 'customer'
                        }
                    ],
                    productOrderItem: [{
                        product: {},
                        productOffering: {
                            id: 1,
                            href: 'http://extexample.com/' + productOfferingPath
                        }
                    }]
                };
    
                nock(CATALOG_SERVER)
                    .get(productOfferingPath)
                    .times(1)
                    .reply(200, { productSpecification: { id: 2, href: SERVER + productSpecPath } });

                nock(CATALOG_SERVER)
                    .get(productSpecPath)
                    .times(1)
                    .reply(200, { relatedParty: [{ id: 'owner', role: 'owner' }] });

                const expected = {
                    status: 422,
                    message: 'Billing Account is required'
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            })

            it('should fail if the product has not owners', function(done) {
                const productOfferingPath = '/api/productOffering/1';
                const productSpecPath = '/api/productSpecification/2';
                const ownerName = 'example';

                const user = {
                    partyId: 'cust'
                };

                const body = {
                    relatedParty: [
                        {
                            id: 'cust',
                            role: 'customer'
                        }
                    ],
                    productOrderItem: [
                        {
                            product: {},
                            productOffering: {
                                id: 1, 
                                href: SERVER + productOfferingPath
                            }
                        }
                    ]
                };

                nock(CATALOG_SERVER)
                    .get(productOfferingPath)
                    .reply(200, { productSpecification: { id: 2, href: SERVER + productSpecPath } });

                nock(CATALOG_SERVER)
                    .get(productSpecPath)
                    .reply(200, { relatedParty: [{ id: ownerName, role: 'other_role' }] });

                const expected = {
                    status: 400,
                    message: 'You cannot order a product without owners'
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail if the offering attached to the order cannot be retrieved', function(done) {
                const SERVER = 'http://example.com';
                const productOfferingPath = '/api/productOffering/1';

                const orderItemId = 1;

                const user = {
                    partyId: 'cust'
                };

                const body = {
                    relatedParty: [
                        {
                            id: 'cust',
                            role: 'customer'
                        }
                    ],
                    productOrderItem: [
                        {
                            id: orderItemId,
                            product: {},
                            productOffering: {
                                
                                href: SERVER + productOfferingPath
                            }
                        }
                    ]
                };

                nock(CATALOG_SERVER)
                    .get(productOfferingPath)
                    .reply(500);

                const expected = {
                    status: 400,
                    message: 'The system fails to retrieve the offering attached to the ordering item ' + orderItemId
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail if the product attached to the order cannot be retrieved', function(done) {
                const SERVER = 'http://example.com';
                const productOfferingPath = '/api/productOffering/1';
                const productSpecPath = '/api/product/2';

                const orderItemId = 1;

                const user = {
                    partyId: 'cust'
                };

                const body = {
                    relatedParty: [
                        {
                            id: 'cust',
                            role: 'customer'
                        }
                    ],
                    productOrderItem: [
                        {
                            id: orderItemId,
                            product: {},
                            productOffering: {
                                id: 1,
                                href: SERVER + productOfferingPath
                            }
                        }
                    ]
                };

                nock(CATALOG_SERVER)
                    .get(productOfferingPath)
                    .reply(200, { productSpecification: { href: SERVER + productSpecPath } });

                nock(CATALOG_SERVER)
                    .get(productSpecPath)
                    .reply(500);

                const expected = {
                    status: 400,
                    message: 'The system fails to retrieve the product attached to the ordering item ' + orderItemId
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail when the order is not well formed JSON', function(done) {
                const user = {
                    id: 'customer'
                };

                const expected = {
                    status: 400,
                    message: 'The resource is not a valid JSON document'
                };

                testOrderCreation(user, 'invalid', true, true, true, expected, done);
            });

            it('should fail when the user does not have the customer role', function(done) {
                const user = {
                    id: 'test'
                };

                const expected = {
                    status: 403,
                    message: 'You are not authorized to order products'
                };

                const body = {
                    relatedParty: [
                        {
                            id: 'test',
                            role: 'customer'
                        }
                    ]
                };
                testOrderCreation(user, JSON.stringify(body), true, false, true, expected, done);
            });

            it('should fail when the relatedParty field has not been included', function(done) {
                const user = {
                    id: 'cust'
                };

                const expected = {
                    status: 400,
                    message: 'A product order must contain a relatedParty field'
                };

                testOrderCreation(user, JSON.stringify({}), true, true, true, expected, done);
            });

            it('should fail when a customer has not been specified', function(done) {
                const user = {
                    id: 'cust'
                };

                const expected = {
                    status: 403,
                    message: 'It is required to specify a customer in the relatedParty field'
                };

                const body = {
                    relatedParty: [
                        {
                            id: 'cust',
                            role: 'seller'
                        }
                    ]
                };
                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail when the specified customer is not the user making the request', function(done) {
                const user = {
                    id: 'cust'
                };

                const expected = {
                    status: 403,
                    message: 'The customer specified in the product order is not the user making the request'
                };

                const body = {
                    relatedParty: [
                        {
                            id: 'test',
                            role: 'customer'
                        }
                    ]
                };
                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail when the request does not include an productOrderItem field', function(done) {
                const user = {
                    partyId: 'cust'
                };

                const expected = {
                    status: 400,
                    message: 'A product order must contain an productOrderItem field'
                };

                const body = {
                    relatedParty: [
                        {
                            id: 'cust',
                            role: 'customer'
                        }
                    ]
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail when the request does not include a product in an orderItem', function(done) {
                const user = {
                    partyId: 'cust'
                };

                const expected = {
                    status: 400,
                    message: 'A product order must contain an productOrderItem field'
                };

                const body = {
                    relatedParty: [
                        {
                            id: 'cust',
                            role: 'customer'
                        }
                    ],
                    orderItem: [
                        {
                            id: '1'
                        }
                    ]
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail when the request does not include a productOffering in an orderItem', function(done) {
                const user = {
                    partyId: 'cust'
                };

                const expected = {
                    status: 400,
                    message: 'A product order must contain an productOrderItem field'
                };

                const body = {
                    relatedParty: [
                        {
                            id: 'cust',
                            role: 'customer'
                        }
                    ],
                    orderItem: [
                        {
                            id: '1',
                            product: {}
                        }
                    ]
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail when an invalid customer has been specified in a product of an orderItem', function(done) {
                const user = {
                    partyId: 'cust'
                };

                const expected = {
                    status: 403,
                    message: 'The customer specified in the order item 1 is not the user making the request'
                };

                const body = {
                    relatedParty: [
                        {
                            id: 'cust',
                            role: 'customer'
                        }
                    ],
                    productOrderItem: [
                        {
                            id: '1',
                            product: {
                                relatedParty: [
                                    {
                                        id: 'test',
                                        role: 'Customer'
                                    }
                                ]
                            },
                            productOffering: {
                                href: ''
                            }
                        }
                    ]
                };

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });

            it('should fail when the customer is trying to acquire one of his offerings', function(done) {
                const SERVER = 'http://example.com';
                const productOfferingPath = '/api/productOffering/1';
                const productSpecPath = '/api/productSpecification/2';

                const user = {
                    partyId: 'example'
                };

                const expected = {
                    status: 403,
                    message: 'You cannot acquire your own offering'
                };

                const body = {
                    relatedParty: [
                        {
                            id: 'example',
                            role: 'customer'
                        }
                    ],
                    productOrderItem: [
                        {
                            id: '1',
                            product: {
                                relatedParty: [
                                    {
                                        id: 'example',
                                        role: 'Customer'
                                    }
                                ]
                            },
                            productOffering: {
                                id: 1,
                                href: SERVER + productOfferingPath
                            }
                        }
                    ]
                };

                nock(CATALOG_SERVER)
                    .get(productOfferingPath)
                    .reply(200, { productSpecification: { id: 2, href: SERVER + productSpecPath } });

                nock(CATALOG_SERVER)
                    .get(productSpecPath)
                    .reply(200, { relatedParty: [{ role: 'owner', id: 'example' }] });

                testOrderCreation(user, JSON.stringify(body), true, true, true, expected, done);
            });
        });

        /// ///////////////////////////////////////////////////////////////////////////////////////////
        /// //////////////////////////////////////// UPDATE ///////////////////////////////////////////
        /// ///////////////////////////////////////////////////////////////////////////////////////////

        describe('Update (PATCH)', function() {
            const SERVER = 'http://ordering.com:189';

            it('should fail when the body is invalid', function(done) {
                const utils = {
                    validateLoggedIn: validateLoggedOk
                };

                const orderingApi = getOrderingAPI({}, {}, utils);

                const req = {
                    method: 'PATCH',
                    body: '{ invalid JSON'
                };

                orderingApi.checkPermissions(req, function(err) {
                    expect(err).toEqual({
                        status: 400,
                        message: 'The resource is not a valid JSON document'
                    });

                    done();
                });
            });

            it('should fail when the ordering cannot be retrieved', function(done) {
                const productOfferingPath = '/api/productOrdering/ordering/7';

                const orderingApi = getOrderingAPI({}, {}, {});

                const user = {
                    id: 'fiware',
                    href: 'http://www.fiware.org/user/fiware'
                };

                const req = {
                    user: user,
                    method: 'PATCH',
                    body: JSON.stringify({}),
                    apiUrl: productOfferingPath
                };

                nock(SERVER)
                    .get(productOfferingPath)
                    .reply(500, {});

                orderingApi.checkPermissions(req, function(err) {
                    expect(err).toEqual({
                        status: 400,
                        message: 'The requested ordering cannot be retrieved'
                    });

                    done();
                });
            });

            const testUpdate = function(
                hasRoleResponses,
                body,
                previousState,
                previousOrderItems,
                previousNotes,
                refundError,
                expectedError,
                expectedBody,
                done
            ) {
                const user = {
                    partyId: 'fiware',
                    href: 'http://www.fiware.org/user/fiware'
                };

                const orderId = 7;
                const productOrderPath = '/ordering/productOrder/7';
                const productOrderBackendPath = '/api/productOrder/7';

                const tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole']);
                tmfUtils.hasPartyRole.and.returnValues.apply(tmfUtils.hasPartyRole, hasRoleResponses);

                const utils = jasmine.createSpyObj('utils', ['updateBody']);
                utils.validateLoggedIn = validateLoggedOk;

                const storeClient = {
                    storeClient: {
                        refund: function(receivedOrderId, receivedUser, callback) {
                            expect(receivedOrderId).toBe(orderId);
                            expect(receivedUser).toBe(user);
                            callback(refundError);
                        }
                    }
                };

                const orderingApi = getOrderingAPI(storeClient, tmfUtils, utils);

                const req = {
                    user: user,
                    method: 'PATCH',
                    body: JSON.stringify(body),
                    apiUrl: productOrderPath
                };

                const orderingRelatedParties = [{}, {}];

                nock(SERVER)
                    .get(productOrderBackendPath)
                    .reply(200, {
                        id: orderId,
                        state: previousState,
                        relatedParty: orderingRelatedParties,
                        productOrderItem: previousOrderItems,
                        note: previousNotes
                    });

                orderingApi.checkPermissions(req, function(err) {
                    expect(err).toEqual(expectedError);

                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(
                        req,
                        jasmine.arrayContaining(orderingRelatedParties),
                        'Customer'
                    );
                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(
                        req,
                        jasmine.arrayContaining(orderingRelatedParties),
                        'Seller'
                    );

                    if (expectedBody) {
                        expect(utils.updateBody).toHaveBeenCalledWith(req, expectedBody);
                    }

                    done();
                });
            };

            it('should not fail when customer tries to update a non in progress ordering', function(done) {
                const previousState = 'Acknowledged';
                testUpdate(
                    [true, false],
                    { description: 'New Description' },
                    previousState,
                    [],
                    [],
                    null,
                    null,
                    null,
                    done
                );
            });

            it('should fail when the user is not consumer or seller in the ordering', function(done) {
                const expectedError = {
                    status: 403,
                    message: 'You are not authorized to modify this order'
                };

                testUpdate([false, false], {}, 'InProgress', [], [], null, expectedError, null, done);
            });

            it('should fail when a customer tries to modify the productOrderItem field', function(done) {
                const expectedError = {
                    status: 403,
                    message: 'Order items can only be modified by sellers'
                };

                testUpdate([true, false], { productOrderItem: [] }, 'InProgress', [], [], null, expectedError, null, done);
            });

            it('should fail when a customer tries to modify the relatedParty field', function(done) {
                const expectedError = {
                    status: 403,
                    message: 'Related parties cannot be modified'
                };

                testUpdate([true, false], { relatedParty: [] }, 'InProgress', [], [], null, expectedError, null, done);
            });

            it('should not fail when a customer tries to modify the description', function(done) {
                testUpdate(
                    [true, false],
                    { description: 'New description' },
                    'InProgress',
                    [],
                    [],
                    null,
                    null,
                    null,
                    done
                );
            });

            it('should fail when a customer tries to modify the order state to an invalid state', function(done) {
                const expectedError = {
                    status: 403,
                    message: 'Invalid order state. Valid states for customers are: "cancelled"'
                };

                testUpdate(
                    [true, false],
                    { state: 'Completed' },
                    'InProgress',
                    [{ state: 'Completed' }],
                    [],
                    null,
                    expectedError,
                    null,
                    done
                );
            });

            it('should fail when a customer tries to cancel an ordering with completed items', function(done) {
                const expectedError = {
                    status: 403,
                    message: 'Orderings can only be cancelled when all Order items are in Acknowledged state'
                };

                testUpdate(
                    [true, false],
                    { state: 'Cancelled' },
                    'InProgress',
                    [{ state: 'Completed' }],
                    [],
                    null,
                    expectedError,
                    null,
                    done
                );
            });

            it('should fail when a customer tries to cancel an ordering with failed items', function(done) {
                const expectedError = {
                    status: 403,
                    message: 'Orderings can only be cancelled when all Order items are in Acknowledged state'
                };

                testUpdate(
                    [true, false],
                    { state: 'Cancelled' },
                    'InProgress',
                    [{ state: 'Failed' }],
                    [],
                    null,
                    expectedError,
                    null,
                    done
                );
            });

            it('should fail when a customer tries to cancel an ordering with cancelled items', function(done) {
                const expectedError = {
                    status: 403,
                    message: 'Orderings can only be cancelled when all Order items are in Acknowledged state'
                };

                testUpdate(
                    [true, false],
                    { state: 'Cancelled' },
                    'InProgress',
                    [{ state: 'Cancelled' }],
                    [],
                    null,
                    expectedError,
                    null,
                    done
                );
            });

            it('should fail when refund cannot be completed', function(done) {
                const expectedError = {
                    status: 403,
                    message: 'You cannot cancel orders with completed items'
                };

                testUpdate(
                    [true, false],
                    { state: 'cancelled' },
                    'inProgress',
                    [],
                    [],
                    expectedError,
                    expectedError,
                    null,
                    done
                );
            });

            it('should not fail when refund can be completed', function(done) {
                const previousItems = [{ state: 'acknowledged', id: 7 }, { state: 'acknowledged', id: 9 }];

                const requestBody = {
                    state: 'cancelled',
                    description: 'I do not need this items anymore'
                };

                const expectedItems = JSON.parse(JSON.stringify(previousItems));
                expectedItems.forEach(function(item) {
                    item.state = 'cancelled';
                });

                const expectedBody = JSON.parse(JSON.stringify(requestBody));
                expectedBody.productOrderItem = expectedItems;

                testUpdate([true, false], requestBody, 'inProgress', previousItems, [], null, null, expectedBody, done);
            });

            it('should fail when a seller tries to modify the description', function(done) {
                const expectedError = {
                    status: 403,
                    message: 'Sellers can only modify order items or include notes'
                };

                testUpdate(
                    [false, true],
                    {
                        description: 'New description',
                        productOrderItem: []
                    },
                    'inProgress',
                    [],
                    [],
                    null,
                    expectedError,
                    null,
                    done
                );
            });

            it('should not fail when seller does not include any order item', function(done) {
                const previousOrderItems = [{ id: 1, state: 'inProgress' }];
                testUpdate(
                    [false, true],
                    { productOrderItem: [] },
                    'inProgress',
                    previousOrderItems,
                    [],
                    null,
                    null,
                    { productOrderItem: previousOrderItems, state: 'inProgress' },
                    done
                );
            });

            it('should fail when order item states are incorrect', function(done) {
                const previousOrderItems = [{ id: 1, state: 'rejected' }];
                testUpdate(
                    [false, true],
                    { productOrderItem: [] },
                    'inProgress',
                    previousOrderItems,
                    [],
                    null,
                    { status: 400, message: 'Bad item state'},
                    null,
                    done
                );
            });

            it('should fail when the seller tries to edit a non existing item', function(done) {
                const previousOrderItems = [{ id: 1, state: 'InProgress' }];
                const updatedOrderings = {
                    productOrderItem: [{ id: 2 }]
                };

                const expectedError = {
                    status: 400,
                    message: 'You are trying to edit an non-existing item'
                };

                testUpdate(
                    [false, true],
                    updatedOrderings,
                    'InProgress',
                    previousOrderItems,
                    [],
                    null,
                    expectedError,
                    null,
                    done
                );
            });

            it('should fail when the seller tries to edit a non owned item', function(done) {
                const previousOrderItems = [{ id: 1, state: 'InProgress', product: { relatedParty: [] } }];
                const updatedOrderings = {
                    productOrderItem: [{ id: 1, state: 'Completed', product: { relatedParty: [] } }]
                };

                const expectedError = {
                    status: 403,
                    message: 'You cannot modify an order item if you are not seller'
                };

                testUpdate(
                    [false, true, false],
                    updatedOrderings,
                    'InProgress',
                    previousOrderItems,
                    [],
                    null,
                    expectedError,
                    null,
                    done
                );
            });

            it('should fail when the seller tries to add a new field to the item', function(done) {
                const previousOrderItems = [{ id: 1, state: 'InProgress', product: { relatedParty: [] } }];
                const updatedOrderings = {
                    productOrderItem: [{ id: 1, name: 'Order Item', state: 'InProgress', product: { relatedParty: [] } }]
                };

                const expectedError = {
                    status: 403,
                    message: 'The fields of an order item cannot be modified'
                };

                testUpdate(
                    [false, true, true],
                    updatedOrderings,
                    'InProgress',
                    previousOrderItems,
                    [],
                    null,
                    expectedError,
                    null,
                    done
                );
            });

            it('should fail when the seller tries to remove a field from the item', function(done) {
                const previousOrderItems = [
                    {
                        id: 1,
                        name: 'Order Item',
                        state: 'InProgress',
                        product: { relatedParty: [] }
                    }
                ];
                const updatedOrderings = {
                    productOrderItem: [{ id: 1, state: 'InProgress', product: { relatedParty: [] } }]
                };

                const expectedError = {
                    status: 403,
                    message: 'The fields of an order item cannot be modified'
                };

                testUpdate(
                    [false, true, true],
                    updatedOrderings,
                    'InProgress',
                    previousOrderItems,
                    [],
                    null,
                    expectedError,
                    null,
                    done
                );
            });

            it('should fail when the seller tries to modify the value of a field in the item', function(done) {
                const previousOrderItems = [
                    {
                        id: 1,
                        name: 'Order Item',
                        state: 'InProgress',
                        product: { relatedParty: [] }
                    }
                ];
                const updatedOrderings = {
                    productOrderItem: [{ id: 1, name: 'Order Item #2', state: 'InProgress', product: { relatedParty: [] } }]
                };

                const expectedError = {
                    status: 403,
                    message: 'The value of the field name cannot be changed'
                };

                testUpdate(
                    [false, true, true],
                    updatedOrderings,
                    'InProgress',
                    previousOrderItems,
                    [],
                    null,
                    expectedError,
                    null,
                    done
                );
            });

            it('should not fail when the user tries to modify the state of an item appropiately', function(done) {
                const previousOrderItems = [{ id: 1, state: 'inProgress', product: { relatedParty: [] } }];
                const updatedOrderings = {
                    productOrderItem: [{ id: 1, state: 'completed', product: { relatedParty: [] } }]
                };

                const expectedBody = {
                    productOrderItem: updatedOrderings.productOrderItem,
                    state: 'completed'
                };

                testUpdate(
                    [false, true, true],
                    updatedOrderings,
                    'inProgress',
                    previousOrderItems,
                    [],
                    null,
                    null,
                    expectedBody,
                    done
                );
            });

            // FIXME: Maybe this test can be skipped
            it('should fail when the seller tries to edit a non existing item when there are more than one item', function(done) {
                const previousOrderItems = [{ id: 1, state: 'InProgress' }, { id: 3, state: 'InProgress' }];
                const updatedOrderings = {
                    productOrderItem: [{ id: 2 }]
                };

                const expectedError = {
                    status: 400,
                    message: 'You are trying to edit an non-existing item'
                };

                testUpdate(
                    [false, true],
                    updatedOrderings,
                    'InProgress',
                    previousOrderItems,
                    [],
                    null,
                    expectedError,
                    null,
                    done
                );
            });

            it('should include the items that belong to another sellers', function(done) {
                const previousOrderItems = [
                    { id: 1, state: 'inProgress', name: 'Product1', product: { relatedParty: [] } },
                    { id: 2, state: 'inProgress', name: 'Product2', product: { relatedParty: [] } }
                ];
                const updatedOrderings = {
                    productOrderItem: [{ id: 1, state: 'completed', name: 'Product1', product: { relatedParty: [] } }]
                };

                const expectedOrderItems = JSON.parse(JSON.stringify(previousOrderItems));
                expectedOrderItems.forEach(function(item) {
                    const updateOrderItem = updatedOrderings.productOrderItem.filter(function(updatedItem) {
                        return item.id === updatedItem.id;
                    })[0];

                    if (updateOrderItem) {
                        item.state = updateOrderItem.state;
                    }
                });

                const expectedBody = {
                    productOrderItem: expectedOrderItems,
                    state: 'inProgress'
                };

                testUpdate(
                    [false, true, true],
                    updatedOrderings,
                    'inProgress',
                    previousOrderItems,
                    [],
                    null,
                    null,
                    expectedBody,
                    done
                );
            });

            it('should allow a customer to include a new note when none previously included', function(done) {
                const notesBody = {
                    note: [
                        {
                            text: 'Some text'
                        }
                    ]
                };
                testUpdate([true, false], notesBody, 'InProgress', [], [], null, null, null, done);
            });

            it('should allow a customer to include a new note to the existing ones', function(done) {
                const notesBody = {
                    note: [
                        {
                            text: 'Some text',
                            author: 'testuser'
                        },
                        {
                            text: 'New note',
                            author: 'testuser'
                        }
                    ]
                };

                const prevNotes = [
                    {
                        text: 'Some text',
                        author: 'testuser'
                    }
                ];

                testUpdate([true, false], notesBody, 'InProgress', [], prevNotes, null, null, null, done);
            });

            it('should fail when the customer tries to modify already existing notes', function(done) {
                const notesBody = {
                    note: [
                        {
                            text: 'New note',
                            author: 'testuser'
                        }
                    ]
                };

                const prevNotes = [
                    {
                        text: 'Some text',
                        author: 'testuser'
                    }
                ];

                testUpdate(
                    [true, false],
                    notesBody,
                    'InProgress',
                    [],
                    prevNotes,
                    null,
                    {
                        status: 403,
                        message: 'You are not allowed to modify the existing notes of an order'
                    },
                    null,
                    done
                );
            });

            it('should allow a seller to include a new note', function(done) {
                const notesBody = {
                    note: [
                        {
                            text: 'Some text'
                        }
                    ]
                };
                testUpdate([false, true], notesBody, 'InProgress', [], [], null, null, null, done);
            });
        });
    });

    describe('Post Validation', function() {
        /// ///////////////////////////////////////////////////////////////////////////////////////////
        /// ///////////////////////////////////// NOTIFY STORE ////////////////////////////////////////
        /// ///////////////////////////////////////////////////////////////////////////////////////////

        const getBaseUser = function() {
            return { partyId: 'test' };
        };

        const getBaseOrdering = function(billingAccountPath) {
            return {
                a: 'a',
                productOrderItem: [
                    {
                        billingAccount: [
                            {
                                id: 7,
                                href: B_ACCOUNT_SERVER + billingAccountPath
                            }
                        ]
                    }
                ]
            };
        };

        const testPostValidation = function(
            ordering,
            userInfo,
            storeClient,
            headers,
            getBillingReq,
            updateBillingReq,
            indexes,
            checker
        ) {
            const orderingApi = getOrderingAPI({ storeClient: storeClient }, {}, {});

            const req = {
                method: 'POST',
                user: userInfo,
                body: JSON.stringify(ordering),
                headers: headers
            };

            if (getBillingReq) {
                nock(B_ACCOUNT_SERVER)
                    .get(getBillingReq.path)
                    .reply(getBillingReq.status, getBillingReq.body);
            }

            if (updateBillingReq) {
                nock(B_ACCOUNT_SERVER)
                    .patch(updateBillingReq.path, updateBillingReq.expectedBody)
                    .reply(updateBillingReq.status);
            }

            orderingApi.executePostValidation(req, checker);
        };

        const testPostValidationStoreNotifyOk = function(
            repeatedUser,
            getBillingFails,
            updateBillingFails,
            indexCalled,
            err,
            done
        ) {
            const buildUser = function(userName, role) {
                const user = {
                    partyId: userName,
                    href: 'http://example.com/user/' + userName
                };

                if (role) {
                    user.role = role;
                }
                return user;
            };

            const headers = {};
            const billingAccountPath = '/billingAccount/7';
            const ordering = getBaseOrdering(billingAccountPath);
            const user = getBaseUser();

            const user1 = buildUser('user1', 'customer');
            const user2 = buildUser('user2', 'seller');
            ordering.relatedParty = [user1, user2];

            const getBillingReq = {
                status: getBillingFails ? 500 : 200,
                path: billingAccountPath,
                body: {
                    relatedParty: []
                }
            };

            const billingUser1 = buildUser(user1.id);
            const billingUser2 = buildUser(user2.id);
            billingUser1.role = 'bill responsible';
            billingUser2.role = 'bill responsible';

            if (repeatedUser) {
                // If the user is repeated, we have to push it in the list
                // of users returned by the billing API
                getBillingReq.body.relatedParty.push(user1);

                // When the user is repeated, its role is not changed
                delete billingUser1.role;
            }

            const updateBillingReq = {
                status: updateBillingFails ? 500 : 200,
                path: billingAccountPath,
                expectedBody: {
                    relatedParty: [billingUser1, billingUser2]
                }
            };

            const redirectUrl = 'http://fakepaypal.com';
            const storeClient = jasmine.createSpyObj('storeClient', ['notifyOrder']);
            storeClient.notifyOrder.and.callFake(function(orderInfo, userInfo, callback) {
                callback(null, {
                    body: { redirectUrl: redirectUrl }
                });
            });

            const indexes = jasmine.createSpyObj('indexes', ['saveIndexOrder']);
            indexes.saveIndexOrder.and.callFake(function(body) {
                return Promise.resolve();
            });

            testPostValidation(ordering, user, storeClient, headers, getBillingReq, updateBillingReq, indexes, function(
                err
            ) {
                expect(err).toEqual(err);
                expect(headers).toEqual({ 'X-Redirect-URL': redirectUrl });
                expect(storeClient.notifyOrder).toHaveBeenCalledWith(JSON.stringify(ordering), user, jasmine.any(Function));

                // if (indexCalled) {
                //     expect(indexes.saveIndexOrder).toHaveBeenCalledWith([ordering]);
                // } else {
                //     expect(indexes.saveIndexOrder).not.toHaveBeenCalled();
                // }
                done();
            });
        };

        it('should return extra headers and push all users into the billing account', function(done) {
            testPostValidationStoreNotifyOk(false, false, false, true, null, done);
        });

        it('should not insert repeated users in the billing account', function(done) {
            testPostValidationStoreNotifyOk(true, false, false, true, null, done);
        });

        it('should fail when the billing account cannot be retrieved', function(done) {
            testPostValidationStoreNotifyOk(
                false,
                true,
                false,
                false,
                {
                    status: 500,
                    message: 'Unexpected error when checking the given billing account'
                },
                done
            );
        });

        it('should fail when the billing account cannot be updated', function(done) {
            testPostValidationStoreNotifyOk(
                false,
                false,
                true,
                false,
                {
                    status: 500,
                    message: 'Unexpected error when updating the given billing account'
                },
                done
            );
        });

        it('should fail when store fails at the time of registering the ordering', function(done) {
            const headers = {};
            const ordering = getBaseOrdering('/billing/9');
            const user = getBaseUser();

            const storeClient = jasmine.createSpyObj('storeClient', ['notifyOrder']);
            storeClient.notifyOrder.and.callFake(function(orderInfo, userInfo, callback) {
                callback({ status: 500 });
            });

            testPostValidation(ordering, user, storeClient, {}, null, null, null, function(err) {
                expect(err).toEqual({ status: 500 });
                expect(headers).toEqual({});
                expect(storeClient.notifyOrder).toHaveBeenCalledWith(JSON.stringify(ordering), user, jasmine.any(Function));

                done();
            });
        });

        it('should directly call the callback when the request method is not GET or POST', function(done) {
            const req = {
                method: 'DELETE'
            };

            const orderingApi = getOrderingAPI({}, {}, {});

            orderingApi.executePostValidation(req, function(err) {
                expect(err).toBe(null);
                done();
            });
        });

        /// ///////////////////////////////////////////////////////////////////////////////////////////
        /// /////////////////////////////////// FILTER ORDERINGS //////////////////////////////////////
        /// ///////////////////////////////////////////////////////////////////////////////////////////

        it('should fail if the ordering does not belong to the user', function(done) {
            const tmfUtils = {
                hasPartyRole: function() {
                    return false;
                }
            };

            const req = {
                method: 'GET',
                body: '{}'
            };

            const orderingApi = getOrderingAPI({}, tmfUtils, {});

            orderingApi.executePostValidation(req, function(err) {
                expect(err).toEqual({
                    status: 403,
                    message: 'You are not authorized to retrieve the specified ordering'
                });

                done();
            });
        });

        const testFilterOrders = function(orders, done) {
            const user = { partyId: 'fiware' };

            // Not consumer but seller
            const hasRolesReturnValues = [];
            orders.map((order) => {
                hasRolesReturnValues.push(order.isInvolved); // First customer check
                hasRolesReturnValues.push(false); // First seller check
            });

            orders.map((order) => {
                // Global filter orders check, qs validation
                hasRolesReturnValues.push(order.isInvolved); // First customer check
            })

            const tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole']);
            tmfUtils.hasPartyRole.and.returnValues.apply(tmfUtils.hasPartyRole, hasRolesReturnValues);

            const utils = {};
            utils.updateResponseBody = function(req, newBody) {
                const expectedOrderItem = [];

                orders.forEach(function(order) {
                    if (order.isInvolved) {
                        expectedOrderItem.push(order.item);
                    }
                });
                expect(newBody).toEqual(expectedOrderItem);
            };

            const body = orders.map(function(order) {
                return order.item;
            });
            const req = {
                method: 'GET',
                body: body,
                user: user,
                query: {}
            };

            const orderingApi = getOrderingAPI({}, tmfUtils, utils);

            orderingApi.executePostValidation(req, function(err) {
                expect(err).toBe(null);

                orders.forEach(function(order) {
                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, order.item.relatedParty, 'Customer');
                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, order.item.relatedParty, 'Seller');
                });

                const calls = (orders.length * 2) + orders.length
                expect(tmfUtils.hasPartyRole.calls.count()).toBe(calls);

                done();
            });
        };

        it('should not filter the ordering as the user is involved in', function(done) {
            const order = { item: { productOrderItem: [{}, {}, {}], note: [] }, isInvolved: true };
            testFilterOrders([order], done);
        });

        it('should filter the ordering as the user is not involved in', function(done) {
            const order = { item: { productOrderItem: [{}, {}, {}] }, isInvolved: false };
            testFilterOrders([order], done);
        });

        it('should filter just one ordering as the user is involved in the other one', function(done) {
            const order1 = { item: { productOrderItem: [{}, {}, {}] }, isInvolved: false };
            const order2 = { item: { productOrderItem: [{}, {}, {}], note: [] }, isInvolved: true };
            testFilterOrders([order1, order2], done);
        });

        it('should not filter orderings as the user is involved in both', function(done) {
            const order1 = { item: { productOrderItem: [{}, {}, {}], note: [] }, isInvolved: true };
            const order2 = { item: { productOrderItem: [{}, {}, {}], note: [] }, isInvolved: true };
            testFilterOrders([order1, order2], done);
        });

        it('should filter all the orderings as the user is not involved in either of them', function(done) {
            const order1 = { item: { productOrderItem: [{}, {}, {}] }, isInvolved: false };
            const order2 = { item: { productOrderItem: [{}, {}, {}] }, isInvolved: false };
            testFilterOrders([order1, order2], done);
        });

        const notFilterItemsUserIsCustomer = function(method, done) {
            const user = { id: 'fiware' };
            const orderingRelatedParties = [{ id: 'fiware' }];
            const originalBody = {
                state: 'inProgress',
                relatedParty: orderingRelatedParties,
                note: [],
                orderItem: [{ product: { relatedParty: [{ id: 'fiware', role: 'customer' }], id: 7 } }]
            };
            const expectedBody = JSON.parse(JSON.stringify(originalBody));

            const tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole']);
            tmfUtils.hasPartyRole.and.returnValues.apply(tmfUtils.hasPartyRole, [true, false]);

            const utils = {};
            utils.updateResponseBody = function(req, newBody) {
                expect(newBody).toEqual(expectedBody);
            };

            const req = {
                method: method,
                body: originalBody,
                user: user
            };

            const orderingApi = getOrderingAPI({}, tmfUtils, utils);

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

        const testSeller = function(orderItems, method, done) {
            const user = { partyId: 'fiware' };
            const orderingRelatedParties = [];
            const originalBody = { relatedParty: orderingRelatedParties, productOrderItem: [], note: [], state: 'inProgress' };

            orderItems.forEach(function(item) {
                originalBody.productOrderItem.push(item.item);
            });

            // Not consumer but seller
            const hasRolesReturnValues = [false, true];
            orderItems.forEach(function(item) {
                hasRolesReturnValues.push(item.isSeller);
            });

            const tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole']);
            tmfUtils.hasPartyRole.and.returnValues.apply(tmfUtils.hasPartyRole, hasRolesReturnValues);

            const utils = {};
            utils.updateResponseBody = function(req, newBody) {
                const expectedOrderItem = [];

                orderItems.forEach(function(item) {
                    if (item.isSeller) {
                        expectedOrderItem.push(item.item);
                    }
                });

                expect(newBody).toEqual({
                    state: 'inProgress',
                    relatedParty: orderingRelatedParties,
                    productOrderItem: expectedOrderItem,
                    note: []
                });
            };

            const req = {
                method: method,
                // The body returned by the server...
                body: originalBody,
                user: user
            };

            const orderingApi = getOrderingAPI({}, tmfUtils, utils);

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

        const notFilterSingleItem = function(method, done) {
            const orderItemRelatedParties = [{ id: 'fiware', role: 'seller' }];
            const productOrderItem = { item: { product: { relatedParty: orderItemRelatedParties, id: 7 } }, isSeller: true };

            testSeller([productOrderItem], method, done);
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

        const filterSingleElement = function(method, done) {
            const orderItemRelatedParties = [{ id: 'other-seller', role: 'seller' }];
            const productOrderItem = { item: { product: { relatedParty: orderItemRelatedParties, id: 7 } }, isSeller: false };

            testSeller([productOrderItem], method, done);
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

        const filterOneItem = function(method, done) {
            const orderItem1RelatedParties = [{ id: 'other-seller', role: 'seller' }];
            const orderItem2RelatedParties = [{ id: 'fiware', role: 'seller' }];
            const orderItem1 = { item: { product: { relatedParty: orderItem1RelatedParties, id: 7 } }, isSeller: false };
            const orderItem2 = { item: { product: { relatedParty: orderItem2RelatedParties, id: 8 } }, isSeller: true };

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

        const notFilterItems = function(method, done) {
            const orderItemRelatedParties = [{ id: 'fiware', role: 'seller' }];
            const orderItem1 = { item: { product: { relatedParty: orderItemRelatedParties, id: 7 } }, isSeller: true };
            const orderItem2 = { item: { product: { relatedParty: orderItemRelatedParties, id: 8 } }, isSeller: true };

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

        const filterTwoItems = function(method, done) {
            const nowOwnerRelatedParties = [{ id: 'other-seller', role: 'seller' }];
            const ownerRelatedParties = [{ id: 'fiware', role: 'seller' }];
            const orderItem1 = { item: { product: { relatedParty: nowOwnerRelatedParties, id: 7 } }, isSeller: false };
            const orderItem2 = { item: { product: { relatedParty: ownerRelatedParties, id: 8 } }, isSeller: false };
            const orderItem3 = { item: { product: { relatedParty: ownerRelatedParties, id: 9 } }, isSeller: true };

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
