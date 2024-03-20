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

describe('RSS API', function() {
    var config = testUtils.getDefaultConfig();

    var getRSSAPI = function(rssClient, tmfUtils, utils) {
        return proxyquire('../../../controllers/tmf-apis/rss', {
            './../../config': config,
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/rss': rssClient,
            './../../lib/utils': utils
        }).rss;
    };

    beforeEach(function() {
        nock.cleanAll();
    });

    describe('Get Permissions', function() {
        /// ///////////////////////////////////////////////////////////////////////////////////////////
        /// /////////////////////////////////// NOT AUTHENTICATED /////////////////////////////////////
        /// ///////////////////////////////////////////////////////////////////////////////////////////

        describe('Not Authenticated Requests', function() {
            var validateLoggedError = function(req, callback) {
                callback({
                    status: 401,
                    message: 'You need to be authenticated to create/update/delete resources'
                });
            };

            var testNotLoggedIn = function(method, done) {
                var utils = {
                    validateLoggedIn: validateLoggedError
                };

                var rssApi = getRSSAPI({}, {}, utils);
                var path = '/rss';

                // Call the method
                var req = {
                    method: method,
                    url: path
                };

                rssApi.checkPermissions(req, function(err) {
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

            it('should reject not authenticated PUT requests', function(done) {
                testNotLoggedIn('PUT', done);
            });

            it('should reject not authenticated DELETE requests', function(done) {
                testNotLoggedIn('DELETE', done);
            });
        });

        it('should reject not allowed PATCH requests', function(done) {
            var methodNotAllowedStatus = 405;
            var methodNotAllowedMessage = 'This method used is not allowed in the accessed API';

            var utils = {
                methodNotAllowed: function(req, callback) {
                    callback({
                        status: methodNotAllowedStatus,
                        message: methodNotAllowedMessage
                    });
                }
            };

            var rssApi = getRSSAPI({}, {}, utils);
            var path = '/rss';

            // Call the method
            var req = {
                method: 'PATCH',
                url: path
            };

            rssApi.checkPermissions(req, function(err) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(methodNotAllowedStatus);
                expect(err.message).toBe(methodNotAllowedMessage);

                done();
            });
        });
    });

    const testCheckPermissions = function(req, validator, done) {
        const rssClient = {
            rssClient: {}
        };

        const utils = {
            log: function() {}
        };
        const rssApi = getRSSAPI(rssClient, {}, utils);

        rssApi.checkPermissions(req, function(err) {
            validator(err);
            done();
        });
    };

    describe('GET', function() {
        /// ///////////////////////////////////////////////////////////////////////////////////////////
        /// ////////////////////////////////////// GET requests ///////////////////////////////////////
        /// ///////////////////////////////////////////////////////////////////////////////////////////

        it('should call the callback without errors when the user is authorized to retrieve models', function(done) {
            const req = {
                method: 'GET',
                apiUrl: '/rss/models',
                user: {
                    id: 'username',
                    roles: [
                        {
                            name: 'seller'
                        }
                    ]
                }
            };
            const validator = function(err) {
                expect(err).toBe(null);
            };

            testCheckPermissions(req, validator, done);
        });

        it('should call the callback with error if the user is trying to access a private API', function(done) {
            const req = {
                method: 'GET',
                apiUrl: '/rss/aggregators',
                user: {}
            };

            const validator = function(err) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(403);
                expect(err.message).toBe('This API is private');
            };
            testCheckPermissions(req, validator, done);
        });

        it('should call the callback with error if the user is not a seller', function(done) {
            const req = {
                method: 'GET',
                apiUrl: '/rss/models',
                user: {
                    id: 'username',
                    roles: []
                }
            };
            const validator = function(err) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(403);
                expect(err.message).toBe('You are not authorized to access the RSS API');
            };
            testCheckPermissions(req, validator, done);
        });
    });

    describe('Create', function() {
        /// ///////////////////////////////////////////////////////////////////////////////////////////
        /// //////////////////////////////////// POST requests ////////////////////////////////////////
        /// ///////////////////////////////////////////////////////////////////////////////////////////

        it('should call the callback without error after creating a RS model', function(done) {
            const req = {
                method: 'POST',
                apiUrl: '/revenueSharing/models',
                user: {
                    id: 'username',
                    roles: [
                        {
                            name: 'seller'
                        }
                    ]
                },
                body: JSON.stringify({ aggregatorShare: 0 }),
                headers: {}
            };
            const validator = function(err) {
                expect(err).toBe(null);
                const body = JSON.parse(req.body);
                expect(body.aggregatorShare).toBe(config.revenueModel);
            };
            testCheckPermissions(req, validator, done);
        });

        it('should call the callback with error if trying to access the CDRs API using POST', function(done) {
            const req = {
                method: 'POST',
                apiUrl: '/rss/cdrs',
                user: {
                    id: 'username',
                    roles: [
                        {
                            name: 'seller'
                        }
                    ]
                }
            };
            const validator = function(err) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(403);
                expect(err.message).toBe('This API can only be accessed with GET requests');
            };
            testCheckPermissions(req, validator, done);
        });

        it('should call the callback with error if the body is not a valid JSON document', function(done) {
            const req = {
                method: 'POST',
                apiUrl: '/rss/models',
                user: {
                    id: 'username',
                    roles: [
                        {
                            name: 'seller'
                        }
                    ]
                },
                body: {}
            };
            const validator = function(err) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(400);
                expect(err.message).toBe('The provided body is not a valid JSON');
            };
            testCheckPermissions(req, validator, done);
        });

        it('should add callbackUrl to charging backend if not provided', function(done) {
            const chargbackUrl =
                (config.endpoints.charging.appSsl ? 'https' : 'http') +
                '://' +
                config.endpoints.charging.host +
                ':' +
                config.endpoints.charging.port +
                '/charging/api/reportManagement/created';

            const req = {
                method: 'POST',
                apiUrl: '/rss/settlement',
                user: {
                    id: 'username',
                    roles: [
                        {
                            name: 'seller'
                        }
                    ]
                },
                body: JSON.stringify({ aggregatorTotal: 0 }),
                headers: {}
            };

            const validator = function(err) {
                expect(err).toBe(null);
                const body = JSON.parse(req.body);
                expect(body.callbackUrl).toEqual(chargbackUrl);
            };
            testCheckPermissions(req, validator, done);
        });
    });

    describe('Post validation', function() {
        /// ///////////////////////////////////////////////////////////////////////////////////////////
        /// /////////////////////////////////// Post validation ///////////////////////////////////////
        /// ///////////////////////////////////////////////////////////////////////////////////////////

        var testRSSPostValidationNotApply = function(req, done) {
            var rssAPI = getRSSAPI({}, {}, {});

            rssAPI.executePostValidation(req, function(err) {
                expect(err).not.toBe(null);
                done();
            });
        };

        it('should call the callback if the request was not a model retrieving', function(done) {
            var req = {
                method: 'POST'
            };
            testRSSPostValidationNotApply(req, done);
        });

        it('should call the callback if the response contained models', function(done) {
            var req = {
                method: 'GET',
                apiUrl: '/rss/models',
                body: JSON.stringify([{}])
            };
            testRSSPostValidationNotApply(req, done);
        });

        it('should call the callback if the server response body is not a valid JSON', function(done) {
            const req = {
                method: 'GET',
                apiUrl: '/rss/models',
                body: [{}]
            };
            testRSSPostValidationNotApply(req, done);
        });

        it('should call the callback and create the default RS model if the response contains an empty model list', function(done) {
            const req = {
                method: 'GET',
                apiUrl: '/revenueSharing/models',
                body: [],
                user: {
                    id: 'username'
                },
                headers: {}
            };

            const newModel = {
                providerId: 'provider'
            };

            const rssClient = {
                rssClient: {
                    createDefaultModel: function(userInfo, callback) {
                        expect(userInfo.id).toBe('username');
                        callback(null, {
                            body: newModel
                        });
                    }
                }
            };

            const rssAPI = getRSSAPI(rssClient, {}, {});

            rssAPI.executePostValidation(req, function(err) {
                expect(err).toBe(undefined);

                const body = req.body;
                expect(body).toEqual([newModel]);
                done();
            });
        });

        it('should call the callback with error if the server fails creating the default RS model', function(done) {
            const errorStatus = 500;
            const errorMessage = 'Error creating default RS model';
            const req = {
                method: 'GET',
                apiUrl: '/revenueSharing/models',
                body: [],
                user: {
                    id: 'username'
                },
                headers: {}
            };

            const rssClient = {
                rssClient: {
                    createDefaultModel: function(userInfo, callback) {
                        expect(userInfo.id).toBe('username');
                        callback({
                            status: errorStatus,
                            message: errorMessage
                        });
                    }
                }
            };

            const rssAPI = getRSSAPI(rssClient, {}, {});

            rssAPI.executePostValidation(req, function(err) {
                expect(err).not.toBe(undefined);
                expect(err.status).toBe(errorStatus);
                expect(err.message).toBe(errorMessage);
                done();
            });
        });

        it('should call the callback and set to 1 the count if the default RS model has not been created', function(done) {
            const req = {
                method: 'GET',
                apiUrl: '/revenueSharing/models',
                body: {
                    size: 0
                },
                user: {
                    id: 'username'
                },
                headers: {}
            };

            const rssAPI = getRSSAPI({}, {}, {});
            rssAPI.executePostValidation(req, function(err) {
                expect(err).toBe(undefined);

                const body = req.body;
                expect(body).toEqual({
                    size: 1
                });
                done();
            });
        });
    });
});
