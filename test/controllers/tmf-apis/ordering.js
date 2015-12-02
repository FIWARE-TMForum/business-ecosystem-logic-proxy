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

    //////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////// NOT AUTHENTICATED /////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var validateLoggedError = function(req, callback) {
        callback({
            status: 401,
            message: 'You need to be authenticated to create/update/delete resources'
        });
    };

    var testNotLoggedIn = function(method, done) {

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

        orderingApi.checkPermissions(req, function(err) {

            expect(err).not.toBe(null);
            expect(err.status).toBe(401);
            expect(err.message).toBe('You need to be authenticated to create/update/delete resources');

            done();
        });
    };

    it('should reject not authenticated POST requests', function(done) {
        testNotLoggedIn('POST', done);
    });

    it('should reject not authenticated PUT requests', function(done) {
        testNotLoggedIn('PUT', done);
    });

    it('should reject not authenticated PATCH requests', function(done) {
        testNotLoggedIn('PATCH', done);
    });

    it('should reject not authenticated DELETE requests', function(done) {
        testNotLoggedIn('DELETE', done);
    });

    //////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////// CREATION ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var validateLoggedOk = function(req, callback) {
        callback();
    };

    var checkRole = function(userInfo, role) {
        var valid = false;

        if (userInfo.id == 'cust' && role == 'customer') {
            valid = true;
        }

        if (userInfo.id == 'admin' && role == 'provider') {
            valid = true;
        }
        return valid;
    };

    var testOrderCreation = function(userInfo, body, expectedRes, done) {

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

        orderingApi.checkPermissions(req, function(err) {
            expect(err).toEqual(expectedRes);
            done();
        });

    };

    it('should call the callback after validating the request when the user is customer', function(done) {
        var user = {
            id: 'cust'
        };

        var body = {
            relatedParty: [{
                id: 'cust',
                role: 'customer'
            }]
        };
        testOrderCreation(user, JSON.stringify(body), null, done);
    });

    it('should call the callback after validating the request when the user is admin', function(done) {
        var user = {
            id: 'admin'
        };

        var body = {
            relatedParty: [{
                id: 'admin',
                role: 'customer'
            }]
        };

        testOrderCreation(user, JSON.stringify(body), null, done);
    });

    it('should fail when the order is not well formed JSON', function(done) {
        var user = {
            id: 'customer'
        };

        var expected = {
            status: 400,
            message: 'The resource is not a valid JSON document'
        };

        testOrderCreation(user, 'invalid', expected, done);
    });

    it('should fail when the user does not have the customer role nor the admin role', function(done) {
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

    it('should fail when the relatedParty field has not been included', function(done) {
        var user = {
            id: 'cust'
        };

        var expected = {
            status: 400,
            message: 'A product order must contain a relatedParty field'
        };

        testOrderCreation(user, JSON.stringify({}), expected, done);
    });

    it('should fail when the specified customer is not the user making the request', function(done) {
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

    //////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////// POST VALIDATION ///////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var orderInf = {a: 'a'};
    var userInf = {
        id: 'test'
    };

    var redirectUrl = 'http://redirecturl.com';

    var notifyStoreOk = function(orderInfo, userInfo, callback) {
        expect(orderInfo).toEqual(orderInf);
        expect(userInfo).toEqual(userInf);

        var res = {
            body: '{"redirectUrl": "' + redirectUrl + '"}'
        };
        callback(null, res);
    };

    var notifyStoreErr = function(orderInfo, userInfo, callback) {
        expect(orderInfo).toEqual(orderInf);
        expect(userInfo).toEqual(userInf);

        callback({status: 500});
    };

    var testPostValidation = function(notifier, checker) {
        var storeClient = {
            storeClient: {
                notifyOrder: notifier
            }
        };

        var orderingApi = getOrderingAPI(storeClient, {});

        var req = {
            user: userInf,
            body: JSON.stringify(orderInf)
        };

        orderingApi.executePostValidation(req, checker);
    };

    it('should inject extra headers after calling notify store', function(done) {
        testPostValidation(notifyStoreOk, function(err, res) {
            expect(err).toBe(null);
            expect(res).toEqual({
                body: '{"redirectUrl": "' + redirectUrl + '"}',
                extraHdrs: {
                    'X-Redirect-URL': redirectUrl
                }
            });
            done();
        });
    });

    it('should call the callback function after an error in store notification', function(done) {
        testPostValidation(notifyStoreErr, function(err, res) {
            expect(err).toEqual({
                status: 500
            });

            expect(res).toBe(undefined);
            done();
        });
    });
});
