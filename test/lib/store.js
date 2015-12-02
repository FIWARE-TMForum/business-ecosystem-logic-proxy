var nock = require('nock'),
    proxyquire = require('proxyquire'),
    testUtils = require('../utils');


describe('Store Client', function() {

    var config = testUtils.getDefaultConfig();
    
    var storeClient = proxyquire('../../lib/store', {
        './../config': config,
        './utils': {
            attachUserHeaders: function() {}
        }
    }).storeClient;


    var testValidateProductOk = function(protocol, done) {

        // Mock the server
        config.appSsl = protocol === 'https' ? true : false;
        var serverUrl = protocol + '://' + config.appHost + ':' + config.endpoints.charging.port;
        var receivedBody;
        var server = nock(serverUrl, {
            reqheaders: {
                'content-type': 'application/json'
            }
        }).post('/charging/api/assetManagement/assets/validateJob', function(body) {
            receivedBody = body;
            return true;
        }).reply(200);

        // Call the validator
        var productInfo = { 'a': 'b', 'example': 'c' };
        storeClient.validateProduct(productInfo, {id: 'test'}, function(err) {

            var expectedBody = {
                action: 'create',
                product: productInfo
            };

            expect(receivedBody).toEqual(expectedBody);
            expect(err).toBe(null);

            done();
        });

    };

    it('should validate product (HTTP)', function(done) {
        testValidateProductOk('http', done);
    });

    it('should validate product (HTTPS)', function(done) {
        testValidateProductOk('https', done);
    });

    var testValidateProductError = function(errorStatus, response, expectedErrMsg, done) {
        // Mock the server
        config.appSsl = false;
        var serverUrl = 'http' + '://' + config.appHost + ':' + config.endpoints.charging.port;
        var receivedBody;

        nock(serverUrl, {
            reqheaders: {
                'content-type': 'application/json'
            }
        }).post('/charging/api/assetManagement/assets/validateJob', function(body) {
            receivedBody = body;
            return true;
        }).reply(errorStatus, response);

        // Call the validator
        var productInfo = { 'a': 'b', 'example': 'c' };
        storeClient.validateProduct(productInfo, {id: 'test'}, function(err) {

            var expectedBody = {
                action: 'create',
                product: productInfo
            };

            // Check the body received by the server
            expect(receivedBody).toEqual(expectedBody);
 
            // Check the parameters used to call this callback
            expect(err.status).toBe(errorStatus);
            expect(err.message).toBe(expectedErrMsg);

            done();
        });

    };

    it('should not validate product when store returns 400', function(done) {
        var message = 'Invalid field X';
        testValidateProductError(400, { message: message}, message, done);
    });

    it('should not validate product when store returns 403', function(done) {
        var message = 'Forbidden';
        testValidateProductError(403, { message: message}, message, done);
    });

    it('should not validate product when store returns 409', function(done) {
        var message = 'Confict';
        testValidateProductError(409, { message: message}, message, done);
    });

    it('should not validate product when store cannot validate the product', function(done) {
        testValidateProductError(500, 'Internal Server Error', 'The server has failed validating the product specification', done);
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
});