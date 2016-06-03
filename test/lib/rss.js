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

var proxyquire = require('proxyquire'),
    testUtils = require('../utils');

describe('RSS Client', function() {

    var PROVIDER_URL = '/rss/rss/providers';
    var MODELS_URL = '/rss/rss/models';

    var config = testUtils.getDefaultConfig();

    var userInfo = {
        id: 'testuser',
        displayName: 'Test user',
        email: 'testuser@email.com'
    };

    var getRssClient = function(request) {
        return proxyquire('../../lib/rss', {
            './../config': config,
            './utils': {
                attachUserHeaders: function(headers) {
                    headers['X-Nick-Name'] = userInfo.id;
                    headers['X-Email'] = userInfo.email;
                    headers['X-Display-Name'] = userInfo.displayName;
                    headers['X-Roles'] = '';
                }
            },
            'request': request
        }).rssClient;
    };


    var protocol = config.appSsl ? 'https' : 'http';
    var serverUrl = protocol + '://' + config.appHost + ':' + config.endpoints.rss.port;

    var mockRSSServer = function(expOptions, err, resp, body) {
        return function(calledOptions, callback) {
            expect(calledOptions).toEqual(expOptions);
            callback(err, resp, body);
        };
    };

    describe('Create provider', function() {
        it('should call the callback with the RSS server response when creating a provider', function(done) {

            var expOptions = {
                url: serverUrl + PROVIDER_URL,
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'X-Nick-Name': 'proxyAdmin',
                    'X-Roles': config.oauth2.roles.admin,
                    'X-Email': 'proxy@email.com'
                },
                body: JSON.stringify({
                    'providerId': userInfo.id,
                    'providerName': userInfo.displayName
                })
            };

            var request = mockRSSServer(expOptions, null, {
                statusCode: 201
            }, null);

            var rssClient = getRssClient(request);

            rssClient.createProvider(userInfo, function(resp) {
                expect(resp).toBe(null);
                done();
            });
        });
    });

    describe('Create default model', function() {
        var testDefaultModelCreation = function(err, resp, body, expErr, expResp, done) {
            var expOptions = {
                url: serverUrl + MODELS_URL,
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'Accept': 'application/json',
                    'X-Nick-Name': userInfo.id,
                    'X-Display-Name': userInfo.displayName,
                    'X-Roles': '',
                    'X-Email': userInfo.email
                },
                body: JSON.stringify({
                    'aggregatorValue': config.revenueModel,
                    'ownerValue': (100 - config.revenueModel),
                    'algorithmType': 'FIXED_PERCENTAGE',
                    'productClass': 'defaultRevenue'
                })
            };

            var request = mockRSSServer(expOptions, err, resp, body);

            var rssClient = getRssClient(request);

            rssClient.createDefaultModel(userInfo, function(err, resp){
                expect(err).toEqual(expErr);
                expect(resp).toEqual(expResp);
                done();
            })
        };

        it('should call the callback with the response info when the RSS server returns a 201 code', function(done) {
            var status = 201;
            var headers = {
                'content-type': 'application/json'
            };
            var body = {
                aggregatorValue: 30
            };

            testDefaultModelCreation(null, {
                statusCode: status,
                headers: headers
            }, body, null, {
                status: 201,
                headers: headers,
                body: body
            }, done);
        });

        it('should call the callback with the default error message when the server has an error', function(done){
            testDefaultModelCreation('ERROR', null, null, {
                status: 504,
                message: 'An unexpected error prevented your default RS model to be created'
            }, undefined, done);
        });

        var testRSSErrorCode = function(status, done) {
            var errMsg =  'Unexpected error';
            testDefaultModelCreation(null, {
                statusCode: status
            }, JSON.stringify({
                exceptionText: errMsg
            }), {
                status: status,
                message: errMsg
            }, undefined, done);
        };

        it('should call the callback with the error given by the server when it returns a 400 code', function (done) {
            testRSSErrorCode(400, done);
        });

        it('should call the callback with the error given by the server when it returns a 401 code', function (done) {
            testRSSErrorCode(401, done);
        });

        it('should call the callback with the error given by the server when it returns a 403 code', function (done) {
            testRSSErrorCode(403, done);
        });

        it('should call the callback with the error given by the server when it returns a 404 code', function (done) {
            testRSSErrorCode(404, done);
        });
    });

    describe('Retrieve RS Models', function() {
        it('should call the callback with the response when the server responds with a 200 code', function(done) {
            var productClass = 'MyClass';
            var status = 200;
            var headers = {
                'content-type': 'application/json'
            };

            var body = [{
                aggregatorValue: 30
            }];
            var expOptions = {
                url: serverUrl + MODELS_URL + '?productClass=' + productClass,
                method: 'GET',
                headers: {
                    'content-type': 'application/json',
                    'Accept': 'application/json',
                    'X-Nick-Name': userInfo.id,
                    'X-Display-Name': userInfo.displayName,
                    'X-Roles': '',
                    'X-Email': userInfo.email
                }
            };

            var request = mockRSSServer(expOptions, null, {
                statusCode: status,
                headers: headers
            }, body);

            var rssClient = getRssClient(request);

            rssClient.retrieveRSModel(userInfo, productClass, function(err, resp){
                expect(err).toEqual(null);
                expect(resp).toEqual({
                    status: status,
                    headers: headers,
                    body: body
                });
                done();
            })
        });
    });
});
