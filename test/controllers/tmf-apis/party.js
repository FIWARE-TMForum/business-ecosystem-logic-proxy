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

var proxyquire = require('proxyquire');

var testUtils = require('../../utils');

describe('Party API', function() {
    var NOT_LOGGED_ERROR = {
        status: 401,
        message: 'You are not logged in'
    };

    var INVALID_PATH_ERROR = {
        status: 404,
        message: 'The given path is invalid'
    };

    var NOT_AUTH_ERROR = {
        status: 403,
        message: 'You are not allowed to access this resource'
    };

    var loggedIn;
    var config = testUtils.getDefaultConfig();
    var utils = {
        validateLoggedIn: function(req, callback) {
            if (loggedIn) {
                callback(null);
            } else {
                callback(NOT_LOGGED_ERROR);
            }
        }
    };

    var partyAPI = proxyquire('../../../controllers/tmf-apis/party', {
        './../../config': config,
        './../../lib/logger': testUtils.emptyLogger,
        './../../lib/utils': utils
    }).party;

    describe('Party', function() {
        var failIfNotLoggedIn = function(method, done) {
            loggedIn = false;

            var req = {
                method: method
            };

            partyAPI.checkPermissions(req, function(err) {
                expect(err).toBe(NOT_LOGGED_ERROR);
                done();
            });
        };

        describe('Retrieve', function() {
            it('should allow to list parties', function(done) {
                var req = {
                    method: 'GET'
                };

                partyAPI.checkPermissions(req, function(err) {
                    expect(err).toBe(null);
                    done();
                });
            });
        });

        describe('Creation', function() {
            it('should not allow to create parties', function(done) {
                var req = {
                    method: 'POST'
                };

                partyAPI.checkPermissions(req, function(err) {
                    expect(err).toEqual({
                        status: 405,
                        message: 'The HTTP method POST is not allowed in the accessed API'
                    });
                    done();
                });
            });
        });

        describe('Modification', function() {
            var indPath = 'individual/';
            var orgPath = 'organization/';

            var accessPartyTest = function(party, path, user, expectedErr, done) {
                loggedIn = true;

                var req = {
                    apiUrl: '/' + config.endpoints.party.path + '/api/partyManagement/v2/' + path + party,
                    method: 'PATCH',
                    user: user
                };

                partyAPI.checkPermissions(req, function(err) {
                    expect(err).toEqual(expectedErr);
                    done();
                });
            };

            it('should not allow to modify party if not logged in', function(done) {
                failIfNotLoggedIn('PATCH', done);
            });

            it('should not allow to modify party if path and request user id mismatch', function(done) {
                accessPartyTest('user', indPath, { id: 'another_user' }, NOT_AUTH_ERROR, done);
            });

            it('should allow to modify party if path and request user id match', function(done) {
                var user = 'user';
                accessPartyTest(user, indPath, { id: user }, null, done);
            });

            it('should allow to modify party if path and request user id match even if query string included', function(done) {
                var user = 'user';
                accessPartyTest(user + '?fields=status', indPath, { id: user }, null, done);
            });

            it('should not allow to modify party if user ID is not included in the path', function(done) {
                accessPartyTest('', orgPath, { id: 'test' }, INVALID_PATH_ERROR, done);
            });

            it('should allow to modify organization if the user is an org admin', function(done) {
                var userObj = {
                    id: 'org',
                    userNickname: 'user',
                    roles: [{ name: testUtils.getDefaultConfig().oauth2.roles.orgAdmin }]
                };
                accessPartyTest('org', orgPath, userObj, null, done);
            });

            it('should not allow to modify individual if the user is an organization', function(done) {
                var userObj = {
                    id: 'org',
                    userNickname: 'user',
                    roles: [{ name: testUtils.getDefaultConfig().oauth2.roles.orgAdmin }]
                };
                accessPartyTest('org', indPath, userObj, NOT_AUTH_ERROR, done);
            });

            it('should not allow to modify organization if the user is an individual', function(done) {
                var userObj = {
                    id: 'org'
                };
                accessPartyTest('org', orgPath, userObj, NOT_AUTH_ERROR, done);
            });

            it('should not allow to modify organization if the user is not an org admin', function(done) {
                var userObj = {
                    id: 'org',
                    userNickname: 'user',
                    roles: []
                };
                accessPartyTest('org', orgPath, userObj, NOT_AUTH_ERROR, done);
            });

            it('should not allow to modify party if the path is not valid', function(done) {
                loggedIn = true;

                var user = 'test';

                var req = {
                    // OLD // Individual has been replaced by BAD_PATH in this path
                    apiUrl: '/' + config.endpoints.party.path + '/api/partyManagement/v2/BAD_PATH/' + user,
                    method: 'PATCH',
                    user: user
                };

                var expectedErr = {
                    status: 403,
                    message: 'You are not allowed to access this resource'
                };

                partyAPI.checkPermissions(req, function(err) {
                    expect(err).toEqual(INVALID_PATH_ERROR);
                    done();
                });
            });
        });

        it('should return 405 when the used method is not recognized', function(done) {
            loggedIn = true;

            var req = {
                method: 'OPTIONS'
            };

            partyAPI.checkPermissions(req, function(err) {
                expect(err).toEqual({
                    status: 405,
                    message: 'Method not allowed'
                });

                done();
            });
        });
    });
});
