var nock = require('nock'),
    proxyquire = require('proxyquire'),
    testUtils = require('../utils');


describe('Store Client', function() {

    var OFFERING_ASSET = 'offering';
    var PRODUCT_ASSET = 'product';

    var ASSETS_URL_MAPPING = {};
    ASSETS_URL_MAPPING[OFFERING_ASSET] = '/charging/api/assetManagement/assets/offeringJob';
    ASSETS_URL_MAPPING[PRODUCT_ASSET] = '/charging/api/assetManagement/assets/validateJob';

    var ASSETS_FUNCTION_MAPPING = {};
    ASSETS_FUNCTION_MAPPING[OFFERING_ASSET] = 'validateOffering';
    ASSETS_FUNCTION_MAPPING[PRODUCT_ASSET] = 'validateProduct';


    var config = testUtils.getDefaultConfig();
    
    var storeClient = proxyquire('../../lib/store', {
        './../config': config,
        './utils': {
            attachUserHeaders: function() {}
        }
    }).storeClient;


    var testValidateAssetOk = function(assetType, protocol, done) {

        // Mock the server
        config.appSsl = protocol === 'https' ? true : false;
        var serverUrl = protocol + '://' + config.appHost + ':' + config.endpoints.charging.port;
        var receivedBody;

        nock(serverUrl, {
            reqheaders: {
                'content-type': 'application/json'
            }
        }).post(ASSETS_URL_MAPPING[assetType], function(body) {
            receivedBody = body;
            return true;
        }).reply(200);

        // Call the validator
        var assetInfo = { 'a': 'b', 'example': 'c' };
        storeClient[ASSETS_FUNCTION_MAPPING[assetType]](assetInfo, {id: 'test'}, function(err) {

            var expectedBody = {
                action: 'create'
            };

            expectedBody[assetType] = assetInfo;

            expect(receivedBody).toEqual(expectedBody);
            expect(err).toBe(null);

            done();
        });

    };

    // Products

    it('should validate product (HTTP)', function(done) {
        testValidateAssetOk(PRODUCT_ASSET, 'http', done);
    });

    it('should validate product (HTTPS)', function(done) {
        testValidateAssetOk(PRODUCT_ASSET, 'https', done);
    });


    // Offerings

    it('should validate offering (HTTP)', function(done) {
        testValidateAssetOk(OFFERING_ASSET, 'http', done);
    });

    it('should validate offering (HTTPS)', function(done) {
        testValidateAssetOk(OFFERING_ASSET, 'https', done);
    });

    var testValidateProductError = function(assetType, errorStatus, response, expectedErrMsg, done) {
        // Mock the server
        config.appSsl = false;
        var serverUrl = 'http' + '://' + config.appHost + ':' + config.endpoints.charging.port;
        var receivedBody;

        if (errorStatus) {
            nock(serverUrl, {
                reqheaders: {
                    'content-type': 'application/json'
                }
            }).post(ASSETS_URL_MAPPING[assetType], function (body) {
                receivedBody = body;
                return true;
            }).reply(errorStatus, response);
        }

        // Call the validator
        var assetInfo = { 'a': 'b', 'example': 'c' };
        storeClient[ASSETS_FUNCTION_MAPPING[assetType]](assetInfo, {id: 'test'}, function(err) {

            var expectedBody = {
                action: 'create'
            };

            expectedBody[assetType] = assetInfo;

            if (errorStatus) {
                // Check the body received by the server
                expect(receivedBody).toEqual(expectedBody);
            }
 
            // Check the parameters used to call this callback
            expect(err.status).toBe(errorStatus ? errorStatus : 504);
            expect(err.message).toBe(expectedErrMsg);

            done();
        });

    };

    // Products

    it('should not validate product when store returns 400', function(done) {
        var message = 'Invalid field X';
        testValidateProductError(PRODUCT_ASSET, 400, { message: message}, message, done);
    });

    it('should not validate product when store returns 403', function(done) {
        var message = 'Forbidden';
        testValidateProductError(PRODUCT_ASSET, 403, { message: message}, message, done);
    });

    it('should not validate product when store returns 409', function(done) {
        var message = 'Confict';
        testValidateProductError(PRODUCT_ASSET, 409, { message: message}, message, done);
    });

    it('should not validate product when store cannot validate the product', function(done) {
        testValidateProductError(PRODUCT_ASSET, 500, 'Internal Server Error', 'The server has failed validating the product specification', done);
    });

    it('should not validate product when store cannot be accessed', function(done) {
        testValidateProductError(PRODUCT_ASSET, null, null, 'The server has failed validating the product specification', done);
    });

    // Offerings

    it('should not validate offering when store returns 400', function(done) {
        var message = 'Invalid field X';
        testValidateProductError(OFFERING_ASSET, 400, { message: message}, message, done);
    });

    it('should not validate offering when store returns 403', function(done) {
        var message = 'Forbidden';
        testValidateProductError(OFFERING_ASSET, 403, { message: message}, message, done);
    });

    it('should not validate offering when store cannot validate the product', function(done) {
        testValidateProductError(OFFERING_ASSET, 500, 'Internal Server Error', 'The server has failed validating the offering', done);
    });

    it('should not validate offering when store cannot be accessed', function(done) {
        testValidateProductError(OFFERING_ASSET, null, null, 'The server has failed validating the offering', done);
    });

    it('should notify the store the creation of a product order', function(done) {
        // Only a case is tested in since this method relies on makeStoreRequest
        // which has been already tested

        var redirectUrl = 'http://redirecturl.com';

        // Mock the server
        var serverUrl = 'http' + '://' + config.appHost + ':' + config.endpoints.charging.port;
        var receivedBody;
        var response = {
            'redirectUrl': redirectUrl
        };

        nock(serverUrl, {
            reqheaders: {
                'content-type': 'application/json'
            }
        }).post('/charging/api/orderManagement/orders', function(body) {
            receivedBody = body;
            return true;
        }).reply(200, response);

        // Call the validator
        var orderInfo = { 'a': 'b', 'example': 'c' };
        storeClient.notifyOrder(orderInfo, {id: 'test'}, function(err, res) {
            expect(receivedBody).toEqual(orderInfo);
            expect(err).toBe(null);

            var expectedResponse = {
                status: 200,
                body: '{"redirectUrl":"' + redirectUrl + '"}',
                headers: {
                    'content-type': 'application/json'
                }
            };

            expect(res).toEqual(expectedResponse);
            done();
        });
    });

    it('should call callback without errors when refund works', function(done) {

        // Mock the server
        config.appSsl = false;
        var serverUrl = 'http://' + config.appHost + ':' + config.endpoints.charging.port;
        var receivedBody;

        nock(serverUrl, {
            reqheaders: {
                'content-type': 'application/json'
            }
        }).post('/charging/api/orderManagement/orders/refund', function(body) {
            receivedBody = body;
            return true;
        }).reply(200);

        // Call the validator
        var orderId = 7;
        storeClient.refund(orderId, {id: 'test'}, function(err) {

            var expectedBody = {
                orderId: orderId
            };

            expect(receivedBody).toEqual(expectedBody);
            expect(err).toBe(null);

            done();
        });

    });

    it('should call callback with errors when refund fails', function(done) {

        var errorStatus = 500;

        // Mock the server
        config.appSsl = false;
        var serverUrl = 'http://' + config.appHost + ':' + config.endpoints.charging.port;
        var receivedBody;

        nock(serverUrl, {
            reqheaders: {
                'content-type': 'application/json'
            }
        }).post('/charging/api/orderManagement/orders/refund', function(body) {
            receivedBody = body;
            return true;
        }).reply(errorStatus);

        // Call the validator
        var orderId = 7;
        storeClient.refund(orderId, {id: 'test'}, function(err) {

            var expectedBody = {
                orderId: orderId
            };

            expect(receivedBody).toEqual(expectedBody);
            expect(err).toEqual({
                status: errorStatus,
                message: 'The server has failed at the time of refunding the order'
            });

            done();
        });

    });

    it('should call callback without errors when usage notification works', function (done) {

        // Mock the server
        config.appSsl = false;
        var serverUrl = 'http://' + config.appHost + ':' + config.endpoints.charging.port;

        nock(serverUrl, {
            reqheaders: {
                'content-type': 'application/json'
            }
        }).post('/charging/api/orderManagement/accounting/', function (body) {
            return true;
        }).reply(200);

        storeClient.validateUsage({}, function (err) {

            expect(err).toBe(null);

            done();
        });
    });

    it('should call callback with errors when usage notification fails', function (done) {

        var errorStatus = 500;

        // Mock the server
        config.appSsl = false;
        var serverUrl = 'http://' + config.appHost + ':' + config.endpoints.charging.port;

        nock(serverUrl, {
            reqheaders: {
                'content-type': 'application/json'
            }
        }).post('/charging/api/orderManagement/accounting/', function (body) {
            return true;
        }).reply(errorStatus);

        storeClient.validateUsage({}, function (err) {

            expect(err).toEqual({
                status: errorStatus,
                message: 'The server has failed validating the usage'
            });

            done();
        });
    });

});