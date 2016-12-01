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

describe('Auth lib', function () {

    var config = testUtils.getDefaultConfig();

    var getAuthLib = function(strategy, tokenService, unauthorized, party) {
        return proxyquire('../../lib/auth', {
            '../config': config,
            'passport-fiware-oauth': strategy,
            '../db/schemas/tokenService': tokenService,
	    './party': party,
	    './utils': {
                log: function() {
                },
                sendUnauthorized: unauthorized
            }
        }).auth;
    };

    var strategy =  {
        OAuth2Strategy: function (options, callback) {
            this._oauth2 = {}
        }
    };

    var getUnauthorizedMock = function (resExp, msgExp, done, validator) {
        return function (res, msg) {
            if (validator) {
                validator();
            }

            expect(res).toBe(resExp);
            expect(msg).toEqual(msgExp);
            done();
        };
    };

    var mockUserProfile = function (auth, expTokens, err, userProfiles) {
        auth.FIWARE_STRATEGY._userProfile = function (token, callback) {
            var index = expTokens.indexOf(token);
            expect(token).not.toEqual(-1);
            callback(err, userProfiles[index]);
        };
    };

    describe('Update party API', function () {
	
	var auth = getAuthLib(strategy, {}, null, {});
	var req = {
	    id: 'test_user',
	    appId: config.oauth2.clientID,
	    user: {accessToken: 'token',
		   orgState: 1,
		   id: 'rick',
		   nickName: 'theMagician',
		   organizations: [{
		       id: '123456789',
		       name: 'patty',
		       roles: [{
			   id: '3',
			   name: 'Seller'
		       }, {
			   id: '6',
			   name: 'provider'
		       }]
		   }, {
		       id: '987654321',
		       name: 'MntyPythn',
		       roles: [{
			   id: '6',
			   name: 'provider'
		       }]
		   }, {
		       id: '111555999',
		       name: 'AmaneceQueNoEsPoco',
		       roles: [{
			   id: '3',
			   name: 'Seller'
			}, {
			    id: '1',
			    name: 'purchuaser'
			}]
		   }]
		  }
        };
	
	it ('should continue with middleware processing if not user object has been provided', function (done) {
	    var req = {
		id: 'test_user',
		appId: config.oauth2.clientID,
            };
	    auth.checkOrganizations(req, {}, done());
	});

	it ('should continue with middleware processing if the request have been already processed', function (done) {
	    var req = {
		id: 'test_user',
		appId: config.oauth2.clientID,
		user: {accessToken: 'token',
		       id: 'eugenio'}
            };
	    var party = {getOrganization: function (orgId, callback) {}}
	    spyOn(party, 'getOrganization').and.callFake(function (orgId, callback) {
		callback({status: 500, message: 'An error occurred during request', body: 'Server error'})
	    });
	    auth.getCache()['token'] = {orgState: 3};
	    auth.checkOrganizations(req, {}, function() {
		expect(party.getOrganization).not.toHaveBeenCalled();
		done();
	    });
	});

	it ('should continue with middleware processing if the request if currently being processed', function (done) {
	    var req = {
		id: 'test_user',
		appId: config.oauth2.clientID,
		user: { accessToken: 'token',
			id: 'eugenio'}
            };
	    
	    var party = {getOrganization: function (orgId, callback) {}}
	    spyOn(party, 'getOrganization').and.callFake(function (orgId, callback) {
		callback({status: 500, message: 'An error occurred during request', body: 'Server error'})
	    });
	    
	    auth.getCache()['token'] = {orgState: 2};
	    auth.checkOrganizations(req, {}, function () {
		expect(party.getOrganization).not.toHaveBeenCalled();
		done()
	    });
	});

	it ('should continue with middleware processing if getOrganization call fails', function (done) {
	    var party = {getOrganization: function (orgId, callback) {},
			 createOrganization: function (content, callback) {}};
	    var auth = getAuthLib(strategy, {}, null, party);
	    spyOn(party, 'getOrganization').and.callFake(function (orgId, callback) {
		callback({status: 500, message: 'An error occurred during request', body: 'Server error'})
	    });
	    spyOn(party, 'createOrganization');
	    
	    auth.getCache()['token'] = {orgState: 1};
	    auth.checkOrganizations(req, {}, function () {
		expect(party.getOrganization).toHaveBeenCalled();
		expect(party.createOrganization).not.toHaveBeenCalled();
		done();
	    });
	});
	
	it ('should continue with middleware processing if createOrganization call fails', function (done) {
	    var party = {getOrganization: function (orgId, callback) {},
			 createOrganization: function (content, callback) {},
			 updateIndividual: function(finalRoles, callback) {}}
	    var auth = getAuthLib(strategy, {}, null, party);
	    var i = 0;
	    spyOn(party, 'getOrganization').and.callFake(
		function (orgId, callback){
		    switch (i) {
		    case 0:
			i++;
			return callback(null,
					{status: JSON.stringify(200),
					 body: JSON.stringify({id: '123456789',
							       name: 'patty',
							       href: 'www.exampleuri.com/orgs/patty'})
					});
			break;
		    case 1:
			i++;
			return callback(null,
					{status: JSON.stringify(200),
					 body: JSON.stringify({id: '987654321',
							       name: 'MntyPythn',
							       href: 'www.exampleuri.com/orgs/MntyPythn'})
					});
			break;
		    case 2:
			return callback({status: 404, message: 'Org not found'});
			break;
		    }
		}
	    );
	    
	    spyOn(party, 'createOrganization').and.callFake(
		function (content, callback) {
		    return callback({status: 500, message: 'An error occurred while creating the organization'});
		}
	    );

	    spyOn(party, 'updateIndividual');
	    
	    auth.getCache()['token'] = {orgState: 1};
	    auth.checkOrganizations(req, {}, function () {
		expect(party.getOrganization).toHaveBeenCalled();
		expect(party.createOrganization).toHaveBeenCalled();
		expect(party.updateIndividual).not.toHaveBeenCalled();
		done();
	    });
	});

	it('should continue with middleware processing if updateIndividual call fails', function (done) {
	    var party = {getOrganization: function (orgId, callback) {},
			 createOrganization: function (content, callback) {},
			 updateIndividual: function (finalRoles, callback) {}};
	    var auth = getAuthLib(strategy, {}, null, party);
	    
	    var i = 0;
	    spyOn(party, 'getOrganization').and.callFake(
		function (orgId, callback){
		    switch (i) {
		    case 0:
			i++;
			return callback(null,
					{status: JSON.stringify(200),
					 body: JSON.stringify({id: '123456789',
							       name: 'patty',
							       href: 'www.exampleuri.com/orgs/patty'})
					});
			break;
		    case 1:
			i++;
			return callback(null,
					{status: JSON.stringify(200),
					 body: JSON.stringify({id: '987654321',
							       name: 'MntyPythn',
							       href: 'www.exampleuri.com/orgs/MntyPythn'})
					});
			break;
		    case 2:
			return callback({status: 404, message: 'Org not found'});
			break;
		    }
		}
	    );
	    spyOn(party, 'createOrganization').and.callFake(
		function (content, callback) {
		    return callback(null,
				    {status: JSON.stringify(200),
				     body: JSON.stringify({id: '111555999',
							   tradingName: 'AmaneceQueNoEsPoco',
							   href: 'www.exampleuri.com/orgs/AmaneceQueNoEsPoco'})
				    });
		}
	    );

	    spyOn(party, 'updateIndividual').and.callFake(
		function (id, finalRoles, callback) {
		    return callback({status: 500, message: 'An error occurred while updating the individual roles'})
		}
	    )
	    
	    auth.getCache()['token'] = {orgState: 1};
	    auth.checkOrganizations(req, {}, function () {
		expect(party.getOrganization).toHaveBeenCalled();
		expect(party.createOrganization).toHaveBeenCalled();
		expect(party.updateIndividual).toHaveBeenCalled();
		done();
	    });
	    
	});
	
	it('should continue with middleware processing after updating partyAPI backend data', function (done) {
	    var party = {getOrganization: function (orgId, callback) {},
			 createOrganization: function (content, callback) {},
			 updateIndividual: function (finalRoles, callback) {}};
	    var auth = getAuthLib(strategy, {}, null, party);

	    var i = 0;
	    spyOn(party, 'getOrganization').and.callFake(
		function (orgId, callback){
		    switch (i) {
		    case 0:
			i++;
			return callback(null,
					{status: JSON.stringify(200),
					 body: JSON.stringify({id: '123456789',
							       name: 'patty',
							       href: 'www.exampleuri.com/orgs/patty'})
					});
			break;
		    case 1:
			i++;
			return callback(null,
					{status: JSON.stringify(200),
					 body: JSON.stringify({id: '987654321',
							       name: 'MntyPythn',
							       href: 'www.exampleuri.com/orgs/MntyPythn'})
					});
			break;
		    case 2:
			return callback({status: 404, message: 'Org not found'});
			break;
		    }
		}
	    );
	    spyOn(party, 'createOrganization').and.callFake(
		function (content, callback) {
		    return callback(null,
				    {status: JSON.stringify(200),
				     body: JSON.stringify({id: '111555999',
							   tradingName: 'AmaneceQueNoEsPoco',
							   href: 'www.exampleuri.com/orgs/AmaneceQueNoEsPoco'})
				    });
		}
	    );

	    spyOn(party, 'updateIndividual').and.callFake(
		function (id, finalRoles, callback) {
		    return callback(null,
				    {status: 200, message: 'Updated the roles correctly'})
		}
	    )

	    auth.getCache()['token'] = {orgState: 1};
	    auth.checkOrganizations(req, {}, function () {
		expect(party.getOrganization).toHaveBeenCalled();
		expect(party.createOrganization).toHaveBeenCalled();
		expect(party.updateIndividual).toHaveBeenCalled();
		done();
	    });
	    
	});
	
    });
    
    describe('Invalid headers', function () {
        // Request without access token
        it('should continue with middleware processing if not auth header has been provided', function (done) {
            var req = {
                headers: {}
            };

            var auth = getAuthLib(strategy, {}, null, {});

            auth.headerAuthentication(req, {}, function () {
                done();
            });
        });

        // Request invalid token type
        it('should return a non authorized code when the access token type is invalid', function (done) {
            var req = {
                headers: {
                    'authorization': 'Invalid token'
                }
            };

            var resExp = {};
            var msgExp = 'Invalid Auth-Token type (invalid)';

            var unauthorized = getUnauthorizedMock(resExp, msgExp, done);

            var auth = getAuthLib(strategy, {}, unauthorized, {});

            auth.headerAuthentication(req, resExp, function () {
            });
        });
    });

    describe('Platform token', function () {
        // Request not cached invalid auth token
        it ('should return a non authorized code when the access token is not cached and is not valid', function (done) {
            var req = {
                headers: {
                    'authorization': 'Bearer token'
                }
            };

            var resExp = {};
            var msgExp = 'invalid auth-token';

            var unauthorized = getUnauthorizedMock(resExp, msgExp, done);
            var auth = getAuthLib(strategy, {}, unauthorized, {});

            var err = {
                error: 'Invalid token'
            };

            mockUserProfile(auth, ['token'], err, [null]);

            auth.headerAuthentication(req, resExp, function () {
            });
        });

        // Request not cached valid token
        it('should continue with middleware processing and inject user info in the request when the token is valid and not cached', function (done) {
            var req = {
                headers: {
                    'authorization': 'Bearer token'
                }
            };

            var userProfile = {
                id: 'test_user',
                appId: config.oauth2.clientID,
                accessToken: 'token'
            };

            var auth = getAuthLib(strategy, {}, null, {});
            mockUserProfile(auth, ['token'], null, [userProfile]);

            auth.headerAuthentication(req, {}, function () {
                expect(req.user).toBe(userProfile);
                done();
            });
        });

        // Request cached valid token
        it('should continue with middleware processing and inject user info in the request when the token is valid and is cached', function (done) {
            var req = {
                headers: {
                    'authorization': 'Bearer token'
                }
            };

            var userProfile = {
                id: 'test_user',
                appId: config.oauth2.clientID,
                accessToken: 'token',
                expire: Date.now() + 3600000
            };

            var auth = getAuthLib(strategy, {}, null, {});

            auth.getCache()['token'] = userProfile;
            auth.FIWARE_STRATEGY._userProfile = jasmine.createSpy('_userProfile');

            auth.headerAuthentication(req, {}, function () {
                expect(req.user).toBe(userProfile);
                expect(auth.FIWARE_STRATEGY._userProfile).not.toHaveBeenCalled();
                done();
            });
        });
    });

    describe('External token', function () {

        var mockTokenService = function (calls, findErr, profile, refresh) {
            var TokenService = {
                findOne: function (user, callback) {
                    calls.calledToken = true;
                    expect(user.userId).toEqual('test_user');
                    callback(findErr, profile);
                }
            };

            if(refresh) {
                // Mock Token update
                TokenService.update = function (query, data, callback) {
                    calls.calledUpdated = true;
                    expect(query).toEqual({userId: 'test_user'});
                    expect(data.authToken).toEqual(refresh.validToken);
                    expect(data.refreshToken).toEqual(refresh.refreshToken);
                    callback();
                }
            }
            return TokenService;
        };

        var testExternalTokenError = function (findErr, profile, sideEffect, done) {
            var req = {
                headers: {
                    'authorization': 'Bearer external'
                }
            };

            var userProfile = {
                id: 'test_user',
                appId: 'extApp'
            };

            var resExp = {};
            var msgExp = 'It has not been possible to obtain your user info. Have you authorized this app to access your info?';
            var calls = {
                calledToken: false
            };

            var TokenService = mockTokenService(calls, findErr, profile, null);

            var unauthorized = getUnauthorizedMock(resExp, msgExp, done, function () {
                expect(calls.calledToken).toBe(true);
                if (sideEffect) {
                    expect(calls.refreshCalled).toBe(true);
                }
            });

            var auth = getAuthLib(strategy, TokenService, unauthorized, {});

            if (sideEffect) {
                sideEffect(auth, calls);
            }

            mockUserProfile(auth, ['external'], null, [userProfile]);

            auth.headerAuthentication(req, resExp, function () {
            });
        };

        // Request not cached external token, never accessed
        it('should give an unauthorized code when the token is not cached an has not authorized the app to access it info', function (done) {
            testExternalTokenError({error: 'error'}, null, null, done);
        });

        // Request not cached external, error in refresh
        it('should give an unauthorized error when using an external token and the internal one cannot be refreshed', function (done) {
            var savedProfile = {
                userId: 'test_user',
                authToken: 'token',
                refreshToken: 'refresh',
                expire: Date.now() - 100
            };

            testExternalTokenError(null, savedProfile, function(auth, calls) {
                // Mock refresh method
                auth.FIWARE_STRATEGY._oauth2.getOAuthAccessToken = function (refreshT, grant, callback) {
                    calls.refreshCalled = true;
                    expect(refreshT).toEqual('refresh');
                    expect(grant).toEqual({ grant_type: "refresh_token" });
                    callback({error: 'error'}, null, null);
                };
            }, done);

        });

        var testExternalTokenInternalSaved = function (expire, refresh, sideEffect, done) {
            var validToken = 'token';
            var req = {
                headers: {
                    'authorization': 'Bearer external'
                }
            };

            var extProfile = {
                id: 'test_user',
                appId: 'extApp'
            };

            var savedProfile = {
                userId: 'test_user',
                authToken: 'token',
                refreshToken: 'refresh',
                expire: expire
            };

            var intProfile = {
                id: 'test_user',
                accessToken: validToken,
                appId: config.oauth2.clientID
            };

            var calls = {
                calledToken: false,
                calledUpdated: false
            };

            var refreshCalled = false;
            var updatedExp = false;
            var updateParams = null;

            if (refresh) {
                validToken = 'newToken';
                updateParams = {
                    validToken: validToken,
                    refreshToken: 'new_refresh'
                }
            }

            var TokenService = mockTokenService(calls, null, savedProfile, updateParams);

            var auth = getAuthLib(strategy, TokenService, null, {});

            if (refresh) {
                updatedExp = true;

                // Mock refresh method
                auth.FIWARE_STRATEGY._oauth2.getOAuthAccessToken = function (refreshT, grant, callback) {
                    refreshCalled = true;
                    expect(refreshT).toEqual('refresh');
                    expect(grant).toEqual({ grant_type: "refresh_token" });
                    callback(null, validToken, updateParams.refreshToken)
                };
            }

            if (sideEffect) {
                sideEffect(auth);
            }

            mockUserProfile(auth, ['external', validToken], null, [extProfile, intProfile]);

            auth.headerAuthentication(req, {}, function () {
                expect(req.user).toBe(intProfile);
                expect(calls.calledToken).toBe(true);
                expect(calls.calledUpdated).toBe(updatedExp);
                expect(refreshCalled).toBe(refresh);
                done();
            });
        };
        // Request not cached external, not cached internal
        it('should continue with the middleware processing and update request when using a valid external token', function (done) {
            testExternalTokenInternalSaved(Date.now() + 3600000, false, null, done);
        });

        // Request not cached external, not cached internal expired
        it('should continue with the middleware processing and update request when using a valid external token and the save token is expired', function (done) {
            testExternalTokenInternalSaved(Date.now() - 100, true, null, done);
        });

        // Request not cached external, cached internal
        it('should continue the middleware processing when using an external token and the internal is cached', function (done) {
            var req = {
                headers: {
                    'authorization': 'Bearer external'
                }
            };

            var extProfile = {
                id: 'test_user',
                appId: 'extApp'
            };

            var intProfile = {
                id: 'test_user',
                accessToken: 'token',
                appId: config.oauth2.clientID,
                expire: Date.now() + 3600000
            };

            var savedProfile = {
                userId: 'test_user',
                authToken: 'token',
                refreshToken: 'refresh',
                expire: Date.now() + 3600000
            };

            var calls = {
                calledToken: false
            };
            var TokenService = mockTokenService(calls, null, savedProfile, null);

            var auth = getAuthLib(strategy, TokenService, null, {});

            mockUserProfile(auth, ['external'], null, [extProfile]);
            auth.getCache()['token'] = intProfile;

            auth.headerAuthentication(req, {}, function () {
                expect(req.user).toBe(intProfile);
                expect(calls.calledToken).toBe(true);
                done();
            });
        });

        // Request external, cached internal expired
        it('should continue the middleware processing when using an external token and the internal is cached and expired', function (done) {
            testExternalTokenInternalSaved(Date.now() + 3600000, true, function(auth){
                auth.getCache()['token'] = {
                    id: 'test_user',
                    accessToken: 'token',
                    appId: config.oauth2.clientID,
                    expire: Date.now() - 100
                }
            }, done);
        })
    });
});
