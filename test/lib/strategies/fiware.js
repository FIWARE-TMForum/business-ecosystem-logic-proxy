/* Copyright (c) 2021 Future Internet Consulting and Development Solutions S.L.
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
const MockStrategy = require('../../utils').MockStrategy;

describe('Keyrock Strategy', () => {


    const buildStrategyMock = function buildStrategyMock(passport) {
        return proxyquire('../../../lib/strategies/fiware', {
            'passport-fiware-oauth': passport,
        }).strategy;
    }

    describe('Build Strategy', () => {

        it('should create FIWARE strategy with OIDC disabled', async (done) => {
            const passportMock = {
                OAuth2Strategy: MockStrategy
            }

            const toTest = buildStrategyMock(passportMock);

            // Test the strategy builder
            const config = {
                clientID: 'client_id',
                clientSecret: 'client_secret',
                callbackURL: 'http://maket.com/callback',
                server: 'http://ipd.com',
                oidc: true,
                key: 'key'
            }
            const builderToTest = toTest(config);
            const userStrategy = await builderToTest.buildStrategy((accessToken, refreshToken, profile, cbDone) => {
                // Callback configured to be called when the strategy succeeds in the login
                // Check that the callback is properly configured
                expect(accessToken).toEqual('token');
                expect(refreshToken).toEqual('refresh');
                expect(profile).toEqual({
                    expire: 12345678,
                    username: 'username',
                    displayName: 'display name',
                    _json: {
                        exp: 12345678,
                        username: 'username',
                        displayName: 'display name',
                    }
                });

                let params = userStrategy.getParams();
                expect(params).toEqual({
                    clientID: 'client_id',
                    clientSecret: 'client_secret',
                    callbackURL: 'http://maket.com/callback',
                    serverURL: 'http://ipd.com',
                    key: 'key'
                });

                // Check that user profile has been overriden
                userStrategy.setProfileParams(null, {
                    expire: 12345678,
                    username: 'username2',
                    _json: {
                        exp: 12345678,
                        username: 'username2',
                    }
                }, 'token', 'refresh');
                userStrategy.userProfile('newToken', (err, profile) => {
                    expect(err).toBe(null);
                    expect(profile).toEqual({
                        expire: 12345678,
                        username: 'username2',
                        displayName: 'username2',
                        _json: {
                            exp: 12345678,
                            username: 'username2',
                        }
                    })
                    done();
                })
            });

            userStrategy.setProfileParams(null, {
                _json: {
                    exp: 12345678,
                    username: 'username',
                    displayName: 'display name',
                }
            }, 'token', 'refresh');

            userStrategy.loginComplete();
        });

        it('should create FIWARE strategy with OIDC enabled and user info missing', async (done) => {
            const passportMock = {
                OAuth2Strategy: MockStrategy
            }

            const toTest = buildStrategyMock(passportMock);
            const config = {
                clientID: 'client_id',
                clientSecret: 'client_secret',
                callbackURL: 'http://maket.com/callback',
                server: 'http://ipd.com',
                oidc: false,
            }
            const builderToTest = toTest(config);
            const userStrategy = await builderToTest.buildStrategy((accessToken, refreshToken, profile, cbDone) => {
                let params = userStrategy.getParams();
                expect(params).toEqual({
                    clientID: 'client_id',
                    clientSecret: 'client_secret',
                    callbackURL: 'http://maket.com/callback',
                    serverURL: 'http://ipd.com'
                });
                done();
            });

            userStrategy.setProfileParams(null, {
                _json: {
                    exp: 12345678,
                    username: 'username',
                    displayName: 'display name',
                }
            }, 'token', 'refresh');

            userStrategy.loginComplete();
        });

	it('should create FIWARE strategy with default role set and without OIDC', async (done) => {
	    const passportMock = {
                OAuth2Strategy: MockStrategy
            }

            const toTest = buildStrategyMock(passportMock);
	    
	    // Test the strategy builder
            const config = {
                clientID: 'client_id',
                clientSecret: 'client_secret',
                callbackURL: 'http://maket.com/callback',
                server: 'http://ipd.com',
                oidc: false,
                defaultRole: "seller"
            }
            const builderToTest = toTest(config);
	    const userStrategy = await builderToTest.buildStrategy((accessToken, refreshToken, profile, cbDone) => {
                // Callback configured to be called when the strategy succeeds in the login
                // Check that the callback is properly configured
                expect(accessToken).toEqual('token');
                expect(refreshToken).toEqual('refresh');
                expect(profile).toEqual({
                    expire: 12345678,
                    username: 'username',
                    displayName: 'display name',
                    _json: {
                        exp: 12345678,
                        username: 'username',
                        displayName: 'display name',
                    },
		    roles: [{
			name: "seller",
			id: "seller"
		    }]
                });

		let params = userStrategy.getParams();
                expect(params).toEqual({
                    clientID: 'client_id',
                    clientSecret: 'client_secret',
                    callbackURL: 'http://maket.com/callback',
                    serverURL: 'http://ipd.com'
                });
                done();
            });

	    userStrategy.setProfileParams(null, {
                _json: {
                    exp: 12345678,
                    username: 'username',
                    displayName: 'display name',
                }
            }, 'token', 'refresh');

            userStrategy.loginComplete();
	    
	});
    });

    describe('Get Scope', () => {

        function testScope(oidc, expScope) {
            const passportMock = {
                OAuth2Strategy: MockStrategy
            }

            const toTest = buildStrategyMock(passportMock);
            const config = {
                oidc: oidc
            }
            const builderToTest = toTest(config);
            const scope = builderToTest.getScope();
            expect(scope).toEqual(expScope);
        }
        it('should return valid scope with OIDC disabled', () => {
            testScope(true, ['jwt,openid']);
        });

        it('should return valid scope with OIDC enabled', () => {
            testScope(false, ['all_info']);
        });
    });
});
