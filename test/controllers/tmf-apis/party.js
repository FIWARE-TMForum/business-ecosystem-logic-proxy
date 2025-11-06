/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2024 Future Internet Consulting and Development Solutions S.L.
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
const { updateBody } = require('../../../lib/utils');

describe('Party API', function() {
    const NOT_LOGGED_ERROR = {
        status: 401,
        message: 'You are not logged in'
    };

    const INVALID_PATH_ERROR = {
        status: 404,
        message: 'The given path is invalid'
    };

    const INVALID_MEDIUM = {
        status: 400,
        message: 'Invalid contactMedium format'
    }

    const INVALID_NUMBER = {
        status: 422,
        message: 'Invalid phone number'
    };

    const NOT_AUTH_ERROR = {
        status: 403,
        message: 'You are not allowed to access this resource'
    };

    const EDIT_NOT_ENABLED = {
        status: 403,
        message: 'Editing party info is dissabled in this instance'
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
        },
        updateBody: function(req, body) {return ;}
    };

    const buildPartyAPI = (conf, phone) => {
        const tmfUtils = {
            isValidPhoneNumber: function(_) {
                return phone;
            }
        };
        return proxyquire('../../../controllers/tmf-apis/party', {
            './../../config': conf,
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/utils': utils,
            './../../lib/tmfUtils': tmfUtils,
        }).party;
    }

    const partyAPI = buildPartyAPI(config, true);

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

            var accessPartyTest = function(party, path, user, expectedErr, conf, phone, done) {
                loggedIn = true;

                var req = {
                    apiUrl: '/' + config.endpoints.party.path + '/' + path + party,
                    method: 'PATCH',
                    user: user
                };

                req.body = JSON.stringify({
                        contactMedium: [{mediumType: "Email"},{mediumType: "PostalAddress",},
                            {
                                mediumType: "TelephoneNumber",
                                preferred: true,
                                characteristic: {
                                    "contactType": "Mobile",
                                    "phoneNumber": "+34650546882" // correct
                                }
                            }
                        ]
                    })


                if (conf == null) {
                    conf = config;
                }

                const partyLib = buildPartyAPI(conf, phone);

                partyLib.checkPermissions(req, function(err) {
                    expect(err).toEqual(expectedErr);
                    done();
                });
            };

            it('should not allow to modify party if not logged in', function(done) {
                failIfNotLoggedIn('PATCH', done);
            });

            it('should not allow to modify party if path and request user id mismatch', function(done) {
                accessPartyTest('user', indPath, { id: 'another_user' }, NOT_AUTH_ERROR, null, true, done);
            });

            it('should not allow to modify party if editParty setting is dissabled', function (done) {
                const user = 'user';
                const conf = {
                    editParty: false
                };
                accessPartyTest(user, indPath, { partyId: user }, EDIT_NOT_ENABLED, conf, true, done);
            });

            it('should allow to modify party if path and request user id match', function(done) {
                var user = 'user';
                accessPartyTest(user, indPath, { partyId: user }, null, null, true, done);
            });

            it('should allow to modify party if path and request user id match even if query string included', function(done) {
                var user = 'user';
                accessPartyTest(user + '?fields=status', indPath, { partyId: user }, null, null, true, done);
            });

            it('should not allow to modify party if user ID is not included in the path', function(done) {
                accessPartyTest('', orgPath, { partyId: 'test' }, INVALID_PATH_ERROR, null, true, done);
            });

            it('should not allow to modify organization if the phone validator fails', function(done) {
                var userObj = {
                    partyId: 'org',
                    userId: 'user',
                    roles: [{ name: testUtils.getDefaultConfig().roles.orgAdmin }]
                };
                accessPartyTest('org', orgPath, userObj, INVALID_NUMBER, null, false, done);
            });

            it('should allow to modify organization if the user is an org admin', function(done) {
                var userObj = {
                    partyId: 'org',
                    userId: 'user',
                    roles: [{ name: testUtils.getDefaultConfig().roles.orgAdmin }]
                };
                accessPartyTest('org', orgPath, userObj, null, null, true, done);
            });

            it('should not allow to modify individual if the user is an organization', function(done) {
                var userObj = {
                    id: 'org',
                    userId: 'user',
                    roles: [{ name: testUtils.getDefaultConfig().roles.orgAdmin }]
                };
                accessPartyTest('org', indPath, userObj, NOT_AUTH_ERROR, null, true, done);
            });

            it('should not allow to modify organization if the user is an individual', function(done) {
                var userObj = {
                    id: 'org'
                };
                accessPartyTest('org', orgPath, userObj, NOT_AUTH_ERROR, null, true, done);
            });

            it('should not allow to modify organization if the user is not an org admin', function(done) {
                var userObj = {
                    id: 'org',
                    userId: 'user',
                    roles: []
                };
                accessPartyTest('org', orgPath, userObj, NOT_AUTH_ERROR, null, true, done);
            });

            it('should not allow to modify party if medium is not an array', function(done) {
                loggedIn = true;
                var user = {
                    partyId: 'org',
                    userId: 'user',
                    roles: [{ name: testUtils.getDefaultConfig().roles.orgAdmin }]
                };

                var req = {
                    // OLD // Individual has been replaced by BAD_PATH in this path
                    apiUrl: '/' + config.endpoints.party.path + '/organization/org',
                    method: 'PATCH',
                    user: user,
                    body: JSON.stringify({
                        contactMedium: { mediumType: 'Email' }
                    })
                };

                const partyLib = buildPartyAPI(config, true);

                partyLib.checkPermissions(req, function(err) {
                    expect(err).toEqual(INVALID_MEDIUM);
                    done();
                });
            });

            it('should not allow to modify party if the path is not valid', function(done) {
                loggedIn = true;

                var user = 'test';

                var req = {
                    // OLD // Individual has been replaced by BAD_PATH in this path
                    apiUrl: '/' + config.endpoints.party.path + '/' + user,
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
