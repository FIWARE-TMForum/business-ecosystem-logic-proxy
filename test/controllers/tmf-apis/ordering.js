var nock = require('nock'),
    proxyquire =  require('proxyquire'),
    testUtils = require('../../utils');

describe('Ordering API', function() {

    var config = testUtils.getDefaultConfig();
    var SERVER = (config.appSsl ? 'https' : 'http') + '://' + config.appHost + ':' + config.endpoints.ordering.port;
    var CATALOGSERVER = (config.appSsl ? 'https' : 'http') + '://' + config.appHost + ':' + config.endpoints.catalog.port;

    var getOrderingAPI = function(storeClient, tmfUtils, utils) {
        return proxyquire('../../../controllers/tmf-apis/ordering', {
            './../../config': config,
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/store': storeClient,
            './../../lib/tmfUtils': tmfUtils,
            './../../lib/utils': utils
        }).ordering;
    };

    var validateLoggedOk = function (req, callback) {
        callback();
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
        });


        //////////////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////// CREATION //////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        describe('Creation', function() {

            var checkRole = function (userInfo, role) {
                var valid = false;

                if (userInfo.id == 'cust' && role == 'customer') {
                    valid = true;
                }

                if (userInfo.id == 'admin' && role == 'provider') {
                    valid = true;
                }
                return valid;
            };

            var testOrderCreation = function (userInfo, body, customerRoleRequired, expectedRes, done, checkReq) {

                config.customerRoleRequired = customerRoleRequired;

                var utils = {
                    validateLoggedIn: validateLoggedOk,
                    hasRole: checkRole
                };

                var orderingApi = getOrderingAPI({}, {}, utils);

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

            var testValidOrdering = function (nOrderItems, userName, customerRoleRequired, done) {

                var extServer = 'http://extexample.com';
                var productOfferingPath = '/productOffering/1';
                var productSpecPath = '/product/2';
                var ownerName = 'example';

                var user = {
                    id: userName
                };

                var orderItems = [];

                for (var i = 0; i < nOrderItems; i++) {
                    orderItems.push({
                        product: {},
                        productOffering: {
                            href: extServer + productOfferingPath
                        }
                    });
                }

                var body = {
                    relatedParty: [{
                        id: userName,
                        role: 'customer'
                    }],
                    orderItem: orderItems
                };

                nock(CATALOGSERVER)
                    .get(productOfferingPath)
                    .times(nOrderItems)
                    .reply(200, {productSpecification: {href: SERVER + productSpecPath}});

                nock(CATALOGSERVER)
                    .get(productSpecPath)
                    .times(nOrderItems)
                    .reply(200, {relatedParty: [{id: ownerName, role: 'owner'}]});

                testOrderCreation(user, JSON.stringify(body), customerRoleRequired, null, done, function (req) {
                    var newBody = JSON.parse(req.body);
                    //expect(req.headers['content-length']).toBe(newBody.length);
                    expect(newBody.orderItem[0].product.relatedParty).toEqual([
                        {
                            id: userName,
                            role: 'Customer',
                            href: ''
                        },
                        {
                            id: ownerName,
                            role: 'Seller',
                            href: ''
                        }]);
                });
            };

            it('should call the callback after validating the request when the user is not customer but customer role not required', function (done) {
                testValidOrdering(1, 'no_cust', false, done);
            });

            it('should call the callback after validating the request when the user is customer (1 order item)', function (done) {
                testValidOrdering(1, 'cust', true, done);
            });

            it('should call the callback after validating the request when the user is customer (2 order items)', function (done) {
                testValidOrdering(2, 'cust', true, done);
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

                nock(CATALOGSERVER)
                    .get(productOfferingPath)
                    .reply(200, {productSpecification: {href: SERVER + productSpecPath}});

                nock(CATALOGSERVER)
                    .get(productSpecPath)
                    .reply(200, {relatedParty: [{id: ownerName, role: 'other_role'}]});

                var expected = {
                    status: 400,
                    message: 'You cannot order a product without owners'
                };

                testOrderCreation(user, JSON.stringify(body), true, expected, done);

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

                nock(CATALOGSERVER)
                    .get(productOfferingPath)
                    .reply(500);

                var expected = {
                    status: 400,
                    message: 'The system fails to retrieve the offering attached to the ordering item ' + orderItemId
                };

                testOrderCreation(user, JSON.stringify(body), true, expected, done);
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

                nock(CATALOGSERVER)
                    .get(productOfferingPath)
                    .reply(200, {productSpecification: {href: SERVER + productSpecPath}});

                nock(CATALOGSERVER)
                    .get(productSpecPath)
                    .reply(500);

                var expected = {
                    status: 400,
                    message: 'The system fails to retrieve the product attached to the ordering item ' + orderItemId
                };

                testOrderCreation(user, JSON.stringify(body), true, expected, done);

            });

            it('should fail when the order is not well formed JSON', function (done) {
                var user = {
                    id: 'customer'
                };

                var expected = {
                    status: 400,
                    message: 'The resource is not a valid JSON document'
                };

                testOrderCreation(user, 'invalid', true, expected, done);
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
                testOrderCreation(user, JSON.stringify(body), true, expected, done);
            });

            it('should fail when the relatedParty field has not been included', function (done) {
                var user = {
                    id: 'cust'
                };

                var expected = {
                    status: 400,
                    message: 'A product order must contain a relatedParty field'
                };

                testOrderCreation(user, JSON.stringify({}), true, expected, done);
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
                testOrderCreation(user, JSON.stringify(body), true, expected, done);
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
                testOrderCreation(user, JSON.stringify(body), true, expected, done);
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

                testOrderCreation(user, JSON.stringify(body), true, expected, done);
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

                testOrderCreation(user, JSON.stringify(body), true, expected, done);
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

                testOrderCreation(user, JSON.stringify(body), true, expected, done);
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

                testOrderCreation(user, JSON.stringify(body), true, expected, done);
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

            var testUpdate = function (hasRoleResponses, body, previousState, previousOrderItems, refundError, expectedError, expectedBody, done) {

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
                        orderItem: previousOrderItems
                    });

                orderingApi.checkPermissions(req, function (err) {

                    expect(err).toEqual(expectedError);

                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(user, jasmine.arrayContaining(orderingRelatedParties), 'Customer');
                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(user, jasmine.arrayContaining(orderingRelatedParties), 'Seller');

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

                testUpdate([false, true], {orderItem: []}, previousState, [], null, expectedError, null, done);

            });

            it('should not fail when customer tries to update a non in progress ordering', function(done) {
                var previousState = 'Acknowledged';
                testUpdate([true, false], {description: 'New Description'}, previousState, [], null, null, null, done);
            });

            it('should fail when the user is not consumer or seller in the ordering', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'You are not authorized to modify this ordering'
                };

                testUpdate([false, false], {}, 'InProgress', [], null, expectedError, null, done);
            });

            it('should fail when a customer tries to modify the orderItem field', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'Order items can only be modified by sellers'
                };

                testUpdate([true, false], {orderItem: []}, 'InProgress', [], null, expectedError, null, done);
            });

            it('should fail when a customer tries to modify the relatedParty field', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'Related parties cannot be modified'
                };

                testUpdate([true, false], {relatedParty: []}, 'InProgress', [], null, expectedError, null, done);
            });

            it('should not fail when a customer tries to modify the description', function (done) {
                testUpdate([true, false], {description: 'New description'}, 'InProgress', [], null, null, null, done);
            });

            it('should fail when a customer tries to cancel an ordering with completed items', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'Orderings can only be cancelled when all Order items are in Acknowledged state'
                };

                testUpdate([true, false], {state: 'Cancelled'}, 'InProgress', [{state: 'Completed'}],
                    null, expectedError, null, done);
            });

            it('should fail when a customer tries to cancel an ordering with failed items', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'Orderings can only be cancelled when all Order items are in Acknowledged state'
                };

                testUpdate([true, false], {state: 'Cancelled'}, 'InProgress', [{state: 'Failed'}],
                    null, expectedError, null, done);
            });

            it('should fail when a customer tries to cancel an ordering with cancelled items', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'Orderings can only be cancelled when all Order items are in Acknowledged state'
                };

                testUpdate([true, false], {state: 'Cancelled'}, 'InProgress', [{state: 'Cancelled'}],
                    null, expectedError, null, done);
            });

            it('should fail when refund cannot be completed', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'You cannot cancel orders with completed items'
                };

                testUpdate([true, false], {state: 'Cancelled'}, 'InProgress', [], expectedError,
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

                testUpdate([true, false], requestBody, 'InProgress', previousItems, null, null, expectedBody, done);
            });

            it('should fail when a seller tries to modify the description', function (done) {

                var expectedError = {
                    status: 403,
                    message: 'Sellers can only modify order items'
                };

                testUpdate([false, true], {
                    description: 'New description',
                    orderItem: []
                }, 'InProgress', [], null, expectedError, null, done);
            });

            it('should not fail when seller does not include any order item', function (done) {

                var previousOrderItems = [{id: 1, state: 'InProgress'}];
                testUpdate([false, true], {orderItem: []}, 'InProgress', previousOrderItems, null, null,
                    {orderItem: previousOrderItems}, done);
            });

            it('should not fail when seller (that it is also the customer) does not include any order item', function (done) {

                var previousOrderItems = [{id: 1, state: 'InProgress'}];
                var updatedOrderings = {
                    description: 'Example description',
                    orderItem: []
                };

                var expectedBody = JSON.parse(JSON.stringify(updatedOrderings));
                expectedBody['orderItem'] = previousOrderItems;

                testUpdate([true, true], updatedOrderings, 'InProgress', previousOrderItems,
                    null, null, expectedBody, done);
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

                testUpdate([false, true], updatedOrderings, 'InProgress', previousOrderItems,
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

                testUpdate([false, true, false], updatedOrderings, 'InProgress', previousOrderItems,
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

                testUpdate([false, true, true], updatedOrderings, 'InProgress', previousOrderItems,
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

                testUpdate([false, true, true], updatedOrderings, 'InProgress', previousOrderItems,
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

                testUpdate([false, true, true], updatedOrderings, 'InProgress', previousOrderItems,
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

                testUpdate([false, true, true], updatedOrderings, 'InProgress', previousOrderItems,
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

                testUpdate([false, true], updatedOrderings, 'InProgress', previousOrderItems,
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

                testUpdate([false, true, true], updatedOrderings, 'InProgress', previousOrderItems,
                    null, null, expectedBody, done);

            });
        });
    });


    describe('Post Validation', function() {

        //////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////////// NOTIFY STORE ////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        var orderInf = {a: 'a'};
        var userInf = {
            id: 'test'
        };

        var redirectUrl = 'http://redirecturl.com';

        var notifyStoreOk = function (orderInfo, userInfo, callback) {
            expect(orderInfo).toEqual(orderInf);
            expect(userInfo).toEqual(userInf);

            var res = {
                body: '{"redirectUrl": "' + redirectUrl + '"}'
            };
            callback(null, res);
        };

        var notifyStoreErr = function (orderInfo, userInfo, callback) {
            expect(orderInfo).toEqual(orderInf);
            expect(userInfo).toEqual(userInf);

            callback({status: 500});
        };

        var testPostValidation = function (notifier, headers, checker) {
            var storeClient = {
                storeClient: {
                    notifyOrder: notifier
                }
            };

            var orderingApi = getOrderingAPI(storeClient, {}, {});

            var req = {
                method: 'POST',
                user: userInf,
                body: JSON.stringify(orderInf),
                headers: headers
            };

            orderingApi.executePostValidation(req, checker);
        };

        it('should inject extra headers after calling notify store', function (done) {

            var headers = {};

            testPostValidation(notifyStoreOk, headers, function (err) {

                expect(err).toBe(null);
                expect(headers).toEqual({'X-Redirect-URL': redirectUrl});
                done();
            });
        });

        it('should call the callback function after an error in store notification', function (done) {

            var headers = {};

            testPostValidation(notifyStoreErr, {}, function (err) {

                expect(err).toEqual({status: 500});
                expect(headers).toEqual({});

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
                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(user, order.item.relatedParty, 'Customer');
                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(user, order.item.relatedParty, 'Seller');
                });

                expect(tmfUtils.hasPartyRole.calls.count()).toBe(orders.length * 2); // One for customer and one for seller

                done();
            });
        };

        it('should not filter the ordering as the user is involved in', function(done) {

            var order = { item: { orderItems: [ {}, {}, {} ] }, isInvolved: true };
            testFilterOrders([order], done);
        });

        it('should filter the ordering as the user is not involved in', function(done) {

            var order = { item: { orderItems: [ {}, {}, {} ] }, isInvolved: false };
            testFilterOrders([order], done);
        });

        it('should filter just one ordering as the user is involved in the other one', function(done) {

            var order1 = { item: { orderItems: [ {}, {}, {} ] }, isInvolved: false };
            var order2 = { item: { orderItems: [ {}, {}, {} ] }, isInvolved: true };
            testFilterOrders([ order1, order2 ], done);
        });

        it('should not filter orderings as the user is involved in both', function(done) {

            var order1 = { item: { orderItems: [ {}, {}, {} ] }, isInvolved: true };
            var order2 = { item: { orderItems: [ {}, {}, {} ] }, isInvolved: true };
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
                expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(user, orderingRelatedParties, 'Customer');
                expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(user, orderingRelatedParties, 'Seller');
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
            var originalBody = { relatedParty: orderingRelatedParties, orderItem: []  };

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

                expect(newBody).toEqual({ relatedParty: orderingRelatedParties, orderItem: expectedOrderItem });
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

                expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(user, orderingRelatedParties, 'Customer');
                expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(user, orderingRelatedParties, 'Seller');

                orderItems.forEach(function(item) {
                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(user, item.item.product.relatedParty, 'Seller');
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
