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

    const MockStrategy = function MockStrategy(client, cb) {
	this.client = client;
        //this.params = opt.params;
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
        this.cb({access_token: this.token, refresh_token: this.refreshToken}, this.profile, 'cb');
    }
    MockStrategy.prototype.getClient = function () {
        return this.client;
    }

    const discover = async function discover(uri) {
	const client = function(opts) {
	    return {
		discovery_uri: uri,
		client_id: opts.client_id,
		client_secret: opts.client_secret,
		redirect_uris: opts.redirect_uris,
		token_endpoint_auth_method: opts.token_endpoint_auth_method
	    };
	}
	return {
	    Client: client
	};
    }
    const MockIssuer = {
	discover: discover
    };

    const buildStrategyMock = function buildStrategyMock(passport) {
	return proxyquire('../../../lib/strategies/oidc-discover', {
            'openid-client': passport,
        }).strategy;
    }
    
    describe('Build Strategy', () => {
	
	it('should create strategy with default role', async () => {
	    
            const passportMock = {
		Issuer: MockIssuer,
		Strategy: MockStrategy
            };
	    
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
	    //done();
	    const userStrategy = await builderToTest.buildStrategy((accessToken, refreshToken, profile, cbDone) => {
                // Callback configured to be called when the strategy succeeds in the login
                // Check that the callback is properly configured
		expect(accessToken).toEqual('token');
                expect(refreshToken).toEqual('refresh');
                expect(profile).toEqual({
                    username: 'username',
		    preferred_username: 'username',
		    id: 'username',
                    displayName: 'username',
		    organizations: [],
                    roles: [{
			name: "seller",
			id: "seller"
		    }]
                });
		
		let params = userStrategy.getClient();
                expect(params.client).toEqual({
		    discovery_uri: 'http://ipd.com/.well-known/openid-configuration',
                    client_id: 'client_id',
                    client_secret: 'client_secret',
                    redirect_uris: ['http://maket.com/callback'],
		    token_endpoint_auth_method: 'client_secret_basic'
                });
		
            });

	    userStrategy.setProfileParams(null, {
		preferred_username: 'username',
            }, 'token', 'refresh');

            userStrategy.loginComplete();
	    
	});

	it('should return specified scope', () => {
            const passportMock = {
		Issuer: MockIssuer,
                Strategy: MockStrategy
            }

            const toTest = buildStrategyMock(passportMock);

            const config = {
		oidcScopes: ["openid", "profile", "email"]
	    }
            const builderToTest = toTest(config);
            const scope = builderToTest.getScope();

            expect(scope).toEqual(['openid', 'profile', 'email']);
        });
    });
    
});
