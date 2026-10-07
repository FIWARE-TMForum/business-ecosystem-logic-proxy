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
var nock = require('nock');

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

    const INVALID_COUNTRY = {
        status: 422,
        message: 'Invalid country code'
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
    const catalogServer = (config.endpoints.catalog.appSsl ? 'https' : 'http') +
        '://' +
        config.endpoints.catalog.host +
        ':' +
        config.endpoints.catalog.port;
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

    const buildPartyAPI = (conf, phone, operatorId) => {
        const tmfUtils = {
            isValidPhoneNumber: function(_) {
                return phone;
            }
        };
        const operator = {
            operator: {
                getOperatorId: function() {
                    return operatorId;
                }
            }
        };
        return proxyquire('../../../controllers/tmf-apis/party', {
            './../../config': conf,
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/utils': utils,
            './../../lib/tmfUtils': tmfUtils,
            './../../lib/operator': operator
        }).party;
    }

    const partyAPI = buildPartyAPI(config, true);

    afterEach(function() {
        nock.cleanAll();
    });

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

            it('should enable filtered pagination for launched organization list requests', function(done) {
                var req = {
                    method: 'GET',
                    apiUrl: '/party/organization?lifecycleStatus=Launched&limit=2&fields=tradingName',
                    query: {
                        lifecycleStatus: 'Launched',
                        limit: '2',
                        fields: 'tradingName'
                    }
                };

                partyAPI.checkPermissions(req, function(err) {
                    expect(err).toBe(null);
                    expect(req.apiUrl).toBe('/party/organization?limit=2&fields=tradingName');
                    expect(req.query).toEqual({
                        limit: '2',
                        fields: 'tradingName'
                    });

                    const paginationConfig = partyAPI.getFilteredPaginationConfig(req);
                    expect(paginationConfig).not.toBeNull();
                    expect(typeof paginationConfig.predicate).toBe('function');
                    done();
                });
            });

            it('should accept organizations with launched product offerings', function(done) {
                var req = {
                    method: 'GET',
                    apiUrl: '/party/organization?lifecycleStatus=Launched&limit=2',
                    query: {
                        lifecycleStatus: 'Launched',
                        limit: '2'
                    }
                };

                partyAPI.checkPermissions(req, function(err) {
                    expect(err).toBe(null);
                    const paginationConfig = partyAPI.getFilteredPaginationConfig(req);

                    nock(catalogServer)
                        .get(config.endpoints.catalog.apiPath + '/productOffering')
                        .query({
                            'relatedParty.id': 'org-accept',
                            lifecycleStatus: 'Launched',
                            limit: '1'
                        })
                        .reply(200, [{ id: 'offering-1' }]);

                    paginationConfig.predicate({
                        id: 'org-accept'
                    }).then(function(result) {
                        expect(result).toBe(true);
                        done();
                    }).catch(done.fail);
                });
            });

            it('should reject organizations without launched product offerings', function(done) {
                var req = {
                    method: 'GET',
                    apiUrl: '/party/organization?lifecycleStatus=Launched&limit=2',
                    query: {
                        lifecycleStatus: 'Launched',
                        limit: '2'
                    }
                };

                partyAPI.checkPermissions(req, function(err) {
                    expect(err).toBe(null);
                    const paginationConfig = partyAPI.getFilteredPaginationConfig(req);

                    nock(catalogServer)
                        .get(config.endpoints.catalog.apiPath + '/productOffering')
                        .query({
                            'relatedParty.id': 'org-reject',
                            lifecycleStatus: 'Launched',
                            limit: '1'
                        })
                        .reply(200, []);

                    paginationConfig.predicate({
                        id: 'org-reject'
                    }).then(function(result) {
                        expect(result).toBe(false);
                        done();
                    }).catch(done.fail);
                });
            });

            it('should reject the marketplace operator without checking catalog offers', function(done) {
                const partyLib = buildPartyAPI(config, true, 'org-operator');
                var req = {
                    method: 'GET',
                    apiUrl: '/party/organization?lifecycleStatus=Launched&limit=2',
                    query: {
                        lifecycleStatus: 'Launched',
                        limit: '2'
                    }
                };

                partyLib.checkPermissions(req, function(err) {
                    expect(err).toBe(null);
                    const paginationConfig = partyLib.getFilteredPaginationConfig(req);

                    paginationConfig.predicate({
                        id: 'org-operator'
                    }).then(function(result) {
                        expect(result).toBe(false);
                        expect(nock.pendingMocks()).toEqual([]);
                        done();
                    }).catch(done.fail);
                });
            });

            it('should cache accepted organization offer checks', function(done) {
                var req = {
                    method: 'GET',
                    apiUrl: '/party/organization?lifecycleStatus=Launched&limit=2',
                    query: {
                        lifecycleStatus: 'Launched',
                        limit: '2'
                    }
                };

                partyAPI.checkPermissions(req, function(err) {
                    expect(err).toBe(null);
                    const paginationConfig = partyAPI.getFilteredPaginationConfig(req);

                    const scope = nock(catalogServer)
                        .get(config.endpoints.catalog.apiPath + '/productOffering')
                        .query({
                            'relatedParty.id': 'org-cache-accept',
                            lifecycleStatus: 'Launched',
                            limit: '1'
                        })
                        .reply(200, [{ id: 'offering-1' }]);

                    paginationConfig.predicate({
                        id: 'org-cache-accept'
                    }).then(function(firstResult) {
                        expect(firstResult).toBe(true);
                        return paginationConfig.predicate({
                            id: 'org-cache-accept'
                        });
                    }).then(function(secondResult) {
                        expect(secondResult).toBe(true);
                        expect(scope.isDone()).toBe(true);
                        done();
                    }).catch(done.fail);
                });
            });

            it('should cache rejected organization offer checks', function(done) {
                var req = {
                    method: 'GET',
                    apiUrl: '/party/organization?lifecycleStatus=Launched&limit=2',
                    query: {
                        lifecycleStatus: 'Launched',
                        limit: '2'
                    }
                };

                partyAPI.checkPermissions(req, function(err) {
                    expect(err).toBe(null);
                    const paginationConfig = partyAPI.getFilteredPaginationConfig(req);

                    const scope = nock(catalogServer)
                        .get(config.endpoints.catalog.apiPath + '/productOffering')
                        .query({
                            'relatedParty.id': 'org-cache-reject',
                            lifecycleStatus: 'Launched',
                            limit: '1'
                        })
                        .reply(200, []);

                    paginationConfig.predicate({
                        id: 'org-cache-reject'
                    }).then(function(firstResult) {
                        expect(firstResult).toBe(false);
                        return paginationConfig.predicate({
                            id: 'org-cache-reject'
                        });
                    }).then(function(secondResult) {
                        expect(secondResult).toBe(false);
                        expect(scope.isDone()).toBe(true);
                        done();
                    }).catch(done.fail);
                });
            });

            it('should not enable filtered pagination for organization list requests with other lifecycle status', function(done) {
                var req = {
                    method: 'GET',
                    apiUrl: '/party/organization?lifecycleStatus=Active&limit=2',
                    query: {
                        lifecycleStatus: 'Active',
                        limit: '2'
                    }
                };

                partyAPI.checkPermissions(req, function(err) {
                    expect(err).toBe(null);
                    expect(req.apiUrl).toBe('/party/organization?lifecycleStatus=Active&limit=2');
                    expect(partyAPI.getFilteredPaginationConfig(req)).toBeNull();
                    done();
                });
            });

            it('should not enable filtered pagination for individual list requests', function(done) {
                var req = {
                    method: 'GET',
                    apiUrl: '/party/individual?lifecycleStatus=Launched&limit=2',
                    query: {
                        lifecycleStatus: 'Launched',
                        limit: '2'
                    }
                };

                partyAPI.checkPermissions(req, function(err) {
                    expect(err).toBe(null);
                    expect(partyAPI.getFilteredPaginationConfig(req)).toBeNull();
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

            var accessPartyTest = function(party, path, user, expectedErr, conf, phone, done, countryValue) {
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
                        ],
                        ...(countryValue && {partyCharacteristic: [
                            {
                                name: "country",
                                value: countryValue
                            }
                        ]})
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
                accessPartyTest('org', orgPath, userObj, null, null, true, done, "ES");
            });

            it('should not allow to modify organization with a invalid country code', function(done) {
                var userObj = {
                    partyId: 'org',
                    userId: 'user',
                    roles: [{ name: testUtils.getDefaultConfig().roles.orgAdmin }]
                };
                accessPartyTest('org', orgPath, userObj, INVALID_COUNTRY, null, true, done, "France");
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
