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

describe('Github Strategy', () => {
    const MockStrategy = function MockStrategy(params, cb) {
        this.params = params;
        this.cb = cb;
    }
    MockStrategy.prototype.setProfileParams = function(err, profile, token, refreshToken) {
        this.userErr = err;
        this.profile = profile;
        this.token = token;
        this.refreshToken = refreshToken;
    }
    MockStrategy.prototype.userProfile = function(token, done) {
        this.token = token;
        done(this.userErr, this.profile);
    }
    MockStrategy.prototype.loginComplete = function() {
        this.cb(this.token, this.refreshToken, this.profile, 'cb');
    }
    MockStrategy.prototype.getParams = function () {
        return this.params;
    }

    const buildStrategyMock = function buildStrategyMock(passport) {
        return proxyquire('../../../lib/strategies/github', {
            'passport-github': passport,
        }).strategy;
    }

    describe('Build Strategy', () => {
        it ('Should build passport strategy', async (done) => {
            const passportMock = {
                Strategy: MockStrategy
            }

            const toTest = buildStrategyMock(passportMock);

            // Test the strategy builder
            const config = {
                clientID: 'client_id',
                clientSecret: 'client_secret',
                callbackURL: 'http://maket.com/callback',
            }
            const builderToTest = toTest(config);
            const userStrategy = await builderToTest.buildStrategy((accessToken, refreshToken, profile, cbDone) => {
                expect(accessToken).toEqual('token');
                expect(refreshToken).toEqual('refresh');
                expect(profile).toEqual({
                    email: 'fdelavega@email.com',
                    organizations: [],
                    roles: [{
                        'name': 'seller',
                        'id':' seller'
                    }],
                    _json: {
                        email: 'fdelavega@email.com',
                    }
                });

                let params = userStrategy.getParams();
                expect(params).toEqual({
                    clientID: 'client_id',
                    clientSecret: 'client_secret',
                    callbackURL: 'http://maket.com/callback',
                });
                done();
            });

            userStrategy.setProfileParams(null, {
                _json: {
                    email: 'fdelavega@email.com',
                }
            }, 'token', 'refresh');

            userStrategy.loginComplete();
        });

        it ('should return scope', () => {
            const passportMock = {
                Strategy: MockStrategy
            }

            const toTest = buildStrategyMock(passportMock);

            const config = {
                clientID: 'client_id',
                clientSecret: 'client_secret',
                callbackURL: 'http://maket.com/callback',
            }
            const builderToTest = toTest(config);
            const scope = builderToTest.getScope();
            expect(scope).toEqual(['user:email']);
        });
    });
});
