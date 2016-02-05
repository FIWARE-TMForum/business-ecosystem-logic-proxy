var nock = require('nock'),
    proxyquire =  require('proxyquire'),
    testUtils = require('../../utils');

describe('Ordering API', function() {
    var config = testUtils.getDefaultConfig();

    var getOrderingAPI = function(storeClient, tmfUtils) {
        return proxyquire('../../../controllers/tmf-apis/ordering', {
            './../../config': config,
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/store': storeClient,
            './../../lib/tmfUtils': tmfUtils
        }).ordering;
    };

    describe('Get Permissions', function() {

        //////////////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////// NOT AUTHENTICATED /////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        var validateLoggedError = function (req, callback) {
            callback({
                status: 401,
                message: 'You need to be authenticated to create/update/delete resources'
            });
        };

        var testNotLoggedIn = function (method, done) {

            var tmfUtils = {
                validateLoggedIn: validateLoggedError
            };

            var orderingApi = getOrderingAPI({}, tmfUtils);
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


        //////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////// NOT ALLOWED ////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        var methodNotAllowedStatus = 405;
        var methodNotAllowedMessage = 'This method used is not allowed in the accessed API';

        var methodNotAllowed = function (req, callback) {
            callback({
                status: methodNotAllowedStatus,
                message: methodNotAllowedMessage
            });
        };

        var testMethodNotAllowed = function (method, done) {

            var tmfUtils = {
                methodNotAllowed: methodNotAllowed
            };

            var orderingApi = getOrderingAPI({}, tmfUtils);
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

        //////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////// RETRIEVAL //////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        var testRetrieval = function (filterRelatedPartyFields, expectedErr, done) {

            var tmfUtils = {

                validateLoggedIn: function (req, callback) {
                    callback(null);
                },

                filterRelatedPartyFields: filterRelatedPartyFields
            };

            var req = {
                method: 'GET'
            };

            var orderingApi = getOrderingAPI({}, tmfUtils);

            orderingApi.checkPermissions(req, function (err) {

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
        ////////////////////////////////////////// CREATION //////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        var validateLoggedOk = function (req, callback) {
            callback();
        };

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

        var testOrderCreation = function (userInfo, body, expectedRes, done, checkReq) {

            var tmfUtils = {
                validateLoggedIn: validateLoggedOk,
                checkRole: checkRole
            };

            var orderingApi = getOrderingAPI({}, tmfUtils);

            var req = {
                user: userInfo,
                method: 'POST',
                body: body
            };

            orderingApi.checkPermissions(req, function (err) {
                expect(err).toEqual(expectedRes);

                if (checkReq) {
                    checkReq(req);
                }

                done();
            });

        };

        var testValidOrdering = function(nOrderItems, done) {
            var server = 'http://example.com';
            var productOfferingPath = '/productOffering/1';
            var productSpecPath = '/product/2';
            var ownerName = 'example';

            var user = {
                id: 'cust'
            };

            var orderItems = [];

            for (var i = 0; i < nOrderItems; i++) {
                orderItems.push({
                    product: {},
                    productOffering: {
                        href: server + productOfferingPath
                    }
                });
            }

            var body = {
                relatedParty: [{
                    id: 'cust',
                    role: 'customer'
                }],
                orderItem: orderItems
            };

            nock(server)
                .get(productOfferingPath)
                .times(nOrderItems)
                .reply(200, {productSpecification: {href: server + productSpecPath}});

            nock(server)
                .get(productSpecPath)
                .times(nOrderItems)
                .reply(200, {relatedParty: [{id: ownerName, role: 'owner'}]});

            testOrderCreation(user, JSON.stringify(body), null, done, function (req) {
                var newBody = JSON.parse(req.body);
                expect(newBody.orderItem[0].product.relatedParty).toEqual([{
                    id: 'cust',
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

        it('should call the callback after validating the request when the user is customer (1 order item)', function (done) {
            testValidOrdering(1, done);
        });

        it('should call the callback after validating the request when the user is customer (2 order items)', function (done) {
            testValidOrdering(2, done);
        });

        it('should fail if the product has not owners', function (done) {

            var server = 'http://example.com';
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
                        href: server + productOfferingPath
                    }
                }]
            };

            nock(server)
                .get(productOfferingPath)
                .reply(200, {productSpecification: {href: server + productSpecPath}});

            nock(server)
                .get(productSpecPath)
                .reply(200, {relatedParty: [{id: ownerName, role: 'other_role'}]});

            var expected = {
                status: 400,
                message: 'You cannot order a product without owners'
            };

            testOrderCreation(user, JSON.stringify(body), expected, done);

        });

        it('should fail if the offering attached to the order cannot be retrieved', function (done) {

            var server = 'http://example.com';
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
                        href: server + productOfferingPath
                    }
                }]
            };

            nock(server)
                .get(productOfferingPath)
                .reply(500);

            var expected = {
                status: 400,
                message: 'The system fails to retrieve the offering attached to the ordering item ' + orderItemId
            };

            testOrderCreation(user, JSON.stringify(body), expected, done);
        });

        it('should fail if the product attached to the order cannot be retrieved', function (done) {

            var server = 'http://example.com';
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
                        href: server + productOfferingPath
                    }
                }]
            };

            nock(server)
                .get(productOfferingPath)
                .reply(200, {productSpecification: {href: server + productSpecPath}});

            nock(server)
                .get(productSpecPath)
                .reply(500);

            var expected = {
                status: 400,
                message: 'The system fails to retrieve the product attached to the ordering item ' + orderItemId
            };

            testOrderCreation(user, JSON.stringify(body), expected, done);

        });

        it('should fail when the order is not well formed JSON', function (done) {
            var user = {
                id: 'customer'
            };

            var expected = {
                status: 400,
                message: 'The resource is not a valid JSON document'
            };

            testOrderCreation(user, 'invalid', expected, done);
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
            testOrderCreation(user, JSON.stringify(body), expected, done);
        });

        it('should fail when the relatedParty field has not been included', function (done) {
            var user = {
                id: 'cust'
            };

            var expected = {
                status: 400,
                message: 'A product order must contain a relatedParty field'
            };

            testOrderCreation(user, JSON.stringify({}), expected, done);
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
            testOrderCreation(user, JSON.stringify(body), expected, done);
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
            testOrderCreation(user, JSON.stringify(body), expected, done);
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

            testOrderCreation(user, JSON.stringify(body), expected, done);
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

            testOrderCreation(user, JSON.stringify(body), expected, done);
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

            testOrderCreation(user, JSON.stringify(body), expected, done);
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

            testOrderCreation(user, JSON.stringify(body), expected, done);
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

            var orderingApi = getOrderingAPI(storeClient, {});

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

            var orderingApi = getOrderingAPI({}, {});

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
                hasRole: function() {
                    return false;
                }
            };

            var req = {
                method: 'GET',
                body: '{}'
            };

            var orderingApi = getOrderingAPI({}, tmfUtils);

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

            var tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasRole']);
            tmfUtils.hasRole.and.returnValues.apply(tmfUtils.hasRole, hasRolesReturnValues);
            tmfUtils.updateBody = function(req, newBody) {

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

            var orderingApi = getOrderingAPI({}, tmfUtils);

            orderingApi.executePostValidation(req, function(err) {

                expect(err).toBe(null);

                orders.forEach(function(order) {
                    expect(tmfUtils.hasRole).toHaveBeenCalledWith(order.item.relatedParty, 'Customer', user);
                    expect(tmfUtils.hasRole).toHaveBeenCalledWith(order.item.relatedParty, 'Seller', user);
                });

                expect(tmfUtils.hasRole.calls.count()).toBe(orders.length * 2); // One for customer and one for seller

                done();
            });
        };

        it('should not filter the order as the user is involved in', function(done) {

            var order = { item: { orderItems: [ {}, {}, {} ] }, isInvolved: true };
            testFilterOrders([order], done);
        });

        it('should filter the order as the user is not involved in', function(done) {

            var order = { item: { orderItems: [ {}, {}, {} ] }, isInvolved: false };
            testFilterOrders([order], done);
        });

        it('should filter just one order as the user is involved in the other one', function(done) {

            var order1 = { item: { orderItems: [ {}, {}, {} ] }, isInvolved: false };
            var order2 = { item: { orderItems: [ {}, {}, {} ] }, isInvolved: true };
            testFilterOrders([ order1, order2 ], done);
        });

        it('should not fail and not filter items when the user is customer', function(done) {

            var user = { id: 'fiware' };
            var orderingRelatedParties =  [ {id: 'fiware'} ];
            var originalBody = {
                relatedParty: orderingRelatedParties,
                orderItem: [ { product: { relatedParty: [{ id: 'fiware', role: 'customer' }], id: 7 } } ]
            };
            var expectedBody = JSON.parse(JSON.stringify(originalBody));

            var tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasRole']);
            tmfUtils.hasRole.and.returnValues.apply(tmfUtils.hasRole, [true, false]);
            tmfUtils.updateBody = function(req, newBody) {
                expect(newBody).toEqual(expectedBody);
            };

            var req = {
                method: 'GET',
                body: JSON.stringify(originalBody),
                user: user
            };

            var orderingApi = getOrderingAPI({}, tmfUtils);

            orderingApi.executePostValidation(req, function(err) {
                expect(err).toEqual(null);
                expect(tmfUtils.hasRole).toHaveBeenCalledWith(orderingRelatedParties, 'Customer', user);
                expect(tmfUtils.hasRole).toHaveBeenCalledWith(orderingRelatedParties, 'Seller', user);
                expect(tmfUtils.hasRole.calls.count()).toBe(2);

                done();
            });
        });

        var testSeller = function(orderItems, done) {

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

            var tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasRole']);
            tmfUtils.hasRole.and.returnValues.apply(tmfUtils.hasRole, hasRolesReturnValues);
            tmfUtils.updateBody = function(req, newBody) {

                var expectedOrderItem = [];

                orderItems.forEach(function(item) {
                    if (item.isSeller) {
                       expectedOrderItem.push(item.item);
                    }
                });

                expect(newBody).toEqual({ relatedParty: orderingRelatedParties, orderItem: expectedOrderItem });
            };

            var req = {
                method: 'GET',
                body: JSON.stringify(originalBody),
                user: user
            };

            var orderingApi = getOrderingAPI({}, tmfUtils);

            orderingApi.executePostValidation(req, function(err) {

                expect(err).toEqual(null);

                expect(tmfUtils.hasRole).toHaveBeenCalledWith(orderingRelatedParties, 'Customer', user);
                expect(tmfUtils.hasRole).toHaveBeenCalledWith(orderingRelatedParties, 'Seller', user);

                orderItems.forEach(function(item) {
                    expect(tmfUtils.hasRole).toHaveBeenCalledWith(item.item.product.relatedParty, 'Seller', user);
                });

                done();
            });
        };

        it('should not fail if user is seller and item is not filtered as use is the seller', function(done) {

            var orderItemRelatedParties = [{ id: 'fiware', role: 'seller' }];
            var orderItem =  { item: { product: { relatedParty: orderItemRelatedParties, id: 7 } }, isSeller: true };

            testSeller([orderItem], done);
        });


        it('should not fail if user is seller but item is filtered as user is not the seller', function(done) {

            var orderItemRelatedParties = [{ id: 'other-seller', role: 'seller' }];
            var orderItem =  { item: { product: { relatedParty: orderItemRelatedParties, id: 7 } }, isSeller: false };

            testSeller([orderItem], done);
        });

        it('should not fail if user is seller and filter some items', function(done) {

            var orderItem1RelatedParties = [{ id: 'other-seller', role: 'seller' }];
            var orderItem2RelatedParties = [{ id: 'fiware', role: 'seller' }];
            var orderItem1 = { item: { product: { relatedParty: orderItem1RelatedParties, id: 7 } }, isSeller: false };
            var orderItem2 = { item: { product: { relatedParty: orderItem2RelatedParties, id: 8 } }, isSeller: true };


            testSeller([orderItem1, orderItem2], done);
        });

    });
});
