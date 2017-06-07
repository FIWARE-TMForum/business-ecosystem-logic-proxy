/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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
        config.endpoints.charging.appSsl = protocol === 'https' ? true : false;
        var serverUrl = protocol + '://' + config.endpoints.charging.host + ':' + config.endpoints.charging.port;
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
        config.endpoints.charging.appSsl = false;
        var serverUrl = 'http' + '://' + config.endpoints.charging.host + ':' + config.endpoints.charging.port;
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
        testValidateProductError(PRODUCT_ASSET, 400, { error: message}, message, done);
    });

    it('should not validate product when store returns 403', function(done) {
        var message = 'Forbidden';
        testValidateProductError(PRODUCT_ASSET, 403, { error: message}, message, done);
    });

    it('should not validate product when store returns 409', function(done) {
        var message = 'Confict';
        testValidateProductError(PRODUCT_ASSET, 409, { error: message}, message, done);
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
        testValidateProductError(OFFERING_ASSET, 400, { error: message}, message, done);
    });

    it('should not validate offering when store returns 403', function(done) {
        var message = 'Forbidden';
        testValidateProductError(OFFERING_ASSET, 403, { error: message}, message, done);
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
        var serverUrl = 'http' + '://' + config.endpoints.charging.host + ':' + config.endpoints.charging.port;
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
        config.endpoints.charging.appSsl = false;
        var serverUrl = 'http://' + config.endpoints.charging.host + ':' + config.endpoints.charging.port;
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
        config.endpoints.charging.appSsl = false;
        var serverUrl = 'http://' + config.endpoints.charging.host + ':' + config.endpoints.charging.port;
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

    var mockUsageNotification = function testUsageNotification (status, path) {
        // Mock the server
        config.endpoints.charging.appSsl = false;
        var serverUrl = 'http://' + config.endpoints.charging.host + ':' + config.endpoints.charging.port;

        nock(serverUrl, {
            reqheaders: {
                'content-type': 'application/json'
            }
        }).post(path, function (body) {
            return true;
        }).reply(status);
    };

    it('should call callback without errors when usage notification works', function (done) {
        mockUsageNotification(200, '/charging/api/orderManagement/accounting/');
        storeClient.validateUsage({}, function (err) {
            expect(err).toBe(null);
            done();
        });
    });

    it('should call callback with errors when usage notification fails', function (done) {
        var errorStatus = 500;
        mockUsageNotification(errorStatus, '/charging/api/orderManagement/accounting/');
        storeClient.validateUsage({}, function (err) {
            expect(err).toEqual({
                status: errorStatus,
                message: 'The server has failed validating the usage'
            });
            done();
        });
    });

    it('should call callback without error when refresh usage notification works', function(done) {
        mockUsageNotification(200, '/charging/api/orderManagement/accounting/refresh/');
        storeClient.refreshUsage('1', '2', function (err) {
            expect(err).toBe(null);
            done();
        });
    });

    it('should call callback with errors when refresh usage notification fails', function (done) {
        var errorStatus = 500;
        mockUsageNotification(errorStatus, '/charging/api/orderManagement/accounting/refresh/');
        storeClient.refreshUsage('1', '2', function (err) {
            expect(err).toEqual({
                status: errorStatus,
                message: 'The server has failed loading usage info'
            });
            done();
        });
    });
});