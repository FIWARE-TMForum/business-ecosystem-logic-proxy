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

const proxyquire = require('proxyquire');
const testUtils = require('../utils');

describe('RSS Client', function() {
    const MODELS_URL = '/charging/api/revenueSharing/models';

    const config = testUtils.getDefaultConfig();

    const userInfo = {
        partyId: 'testuser',
        displayName: 'Test user',
        email: 'testuser@email.com'
    };

    const getRssClient = function(request) {
        return proxyquire('../../lib/rss', {
            './../config': config,
            './utils': {
                attachUserHeaders: function(headers) {
                    headers['X-Nick-Name'] = userInfo.partyId;
                    headers['X-Email'] = userInfo.email;
                    headers['X-Display-Name'] = userInfo.displayName;
                    headers['X-Roles'] = '';
                }
            },
            axios: request
        }).rssClient;
    };

    const protocol = config.endpoints.rss.appSsl ? 'https' : 'http';
    const serverUrl = protocol + '://' + config.endpoints.rss.host + ':' + config.endpoints.rss.port;

    const mockRSSServer = function(expOptions, err, resp) {
        return {
            request: function(calledOptions) {
                expect(calledOptions).toEqual(expOptions);

                return new Promise((resolve, reject) => {
                    if (err) {
                        reject({
                            response: resp
                        })
                    } else {
                        resolve(resp)
                    }
                })
            }
        }
    };

    describe('Create default model', function() {
        const testDefaultModelCreation = function(err, resp, body, expErr, expResp, done) {
            const expOptions = {
                url: serverUrl + MODELS_URL,
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    Accept: 'application/json',
                    'X-Nick-Name': userInfo.partyId,
                    'X-Display-Name': userInfo.displayName,
                    'X-Roles': '',
                    'X-Email': userInfo.email
                },
                data: {
                    aggregatorShare: config.revenueModel,
                    providerShare: 100 - config.revenueModel,
                    algorithmType: 'FIXED_PERCENTAGE',
                    productClass: 'defaultRevenue',
                    providerId: userInfo.partyId
                }
            };

            resp.data = body

            const request = mockRSSServer(expOptions, err, resp);
            const rssClient = getRssClient(request);

            rssClient.createDefaultModel(userInfo, function(err, resp) {
                expect(err).toEqual(expErr);
                expect(resp).toEqual(expResp);
                done();
            });
        };

        it('should call the callback with the response info when the RSS server returns a 201 code', function(done) {
            const status = 201;
            const headers = {
                'content-type': 'application/json'
            };
            const body = {
                aggregatorShare: 30
            };

            testDefaultModelCreation(
                false,
                {
                    status: status,
                    headers: headers
                },
                body,
                null,
                {
                    status: 201,
                    headers: headers,
                    body: body
                },
                done
            );
        });

        it('should call the callback with the default error message when the server has an error', function(done) {
            testDefaultModelCreation(
                true,
                {
                    status: 504
                },
                null,
                {
                    status: 504,
                    message: 'An unexpected error prevented your default RS model to be created'
                },
                undefined,
                done
            );
        });

        const testRSSErrorCode = function(status, done) {
            const errMsg = 'Unexpected error';
            testDefaultModelCreation(
                true,
                {
                    status: status
                },
                {
                    error: errMsg
                },
                {
                    status: status,
                    message: errMsg
                },
                undefined,
                done
            );
        };

        it('should call the callback with the error given by the server when it returns a 400 code', function(done) {
            testRSSErrorCode(400, done);
        });

        it('should call the callback with the error given by the server when it returns a 401 code', function(done) {
            testRSSErrorCode(401, done);
        });

        it('should call the callback with the error given by the server when it returns a 403 code', function(done) {
            testRSSErrorCode(403, done);
        });

        it('should call the callback with the error given by the server when it returns a 404 code', function(done) {
            testRSSErrorCode(404, done);
        });
    });

    describe('Retrieve RS Models', function() {
        it('should call the callback with the response when the server responds with a 200 code', function(done) {
            const productClass = 'MyClass';
            const status = 200;
            const headers = {
                'content-type': 'application/json'
            };

            const body = [
                {
                    aggregatorShare: 30
                }
            ];
            const expOptions = {
                url: serverUrl + MODELS_URL + '?productClass=' + productClass + '&providerId=' + userInfo.id,
                method: 'GET',
                headers: {
                    'content-type': 'application/json',
                    Accept: 'application/json',
                    'X-Nick-Name': userInfo.partyId,
                    'X-Display-Name': userInfo.displayName,
                    'X-Roles': '',
                    'X-Email': userInfo.email
                }
            };

            const request = mockRSSServer(
                expOptions,
                false,
                {
                    status: status,
                    headers: headers,
                    data: body
                }
            );

            const rssClient = getRssClient(request);

            rssClient.retrieveRSModel(userInfo, productClass, function(err, resp) {
                expect(err).toEqual(null);
                expect(resp).toEqual({
                    status: status,
                    headers: headers,
                    body: body
                });
                done();
            });
        });
    });
});
