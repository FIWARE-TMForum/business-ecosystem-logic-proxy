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

describe('OIDC-Discover Strategy', () => {

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
        return proxyquire('../../../lib/strategies/oidc-discover', {
            'openid-client': passport,
        }).strategy;
    }

    describe('Build Strategy', () => {
	
	it('should create strategy', async (done) => {
	    
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
                oidcScopes: "openid",
		oidcDiscoveryURI: 'http://ipd.com/.well-known/openid-configuration',
		oidcTokenEndpointAuthMethod: "client_secret_basic",
		defaultRole: "seller",
		key: "key"
            }
            const builderToTest = toTest(config);

	});

	
    });
    
});
