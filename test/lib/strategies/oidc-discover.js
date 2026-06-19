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
        const profile = this.profile;
        const tokenSet = {
            access_token: this.token,
            refresh_token: this.refreshToken,
            claims: () => profile
        };
        this.cb(tokenSet, 'cb');
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

	describe('VerifiableCredential profiles', () => {

	    let builderToTest;

	    beforeEach(async () => {
		const passportMock = {
		    Issuer: MockIssuer,
		    Strategy: MockStrategy
		};
		const config = {
		    clientID: 'client_id',
		    clientSecret: 'client_secret',
		    callbackURL: 'http://market.com/callback',
		    server: 'http://idp.com',
		    oidcScopes: 'openid',
		    oidcDiscoveryURI: 'http://idp.com/.well-known/openid-configuration',
		    oidcTokenEndpointAuthMethod: 'client_secret_basic',
		    defaultRole: 'seller',
		    key: 'key'
		};
		const toTest = buildStrategyMock(passportMock);
		builderToTest = toTest(config);
	    });

	    it('should build profile from plain VC credentialSubject', async () => {
		const vcClaims = {
		    type: ['VerifiableCredential'],
		    issuer: 'did:example:issuer',
		    credentialSubject: {
			email: 'user@example.com',
			firstName: 'John',
			familyName: 'Doe',
			roles: [{ names: ['seller'] }]
		    }
		};

		const userStrategy = await builderToTest.buildStrategy((accessToken, refreshToken, profile, cbDone) => {
		    expect(accessToken).toEqual('vc-token');
		    expect(refreshToken).toEqual('vc-refresh');
		    expect(profile.id).toEqual('user@example.com');
		    expect(profile.email).toEqual('user@example.com');
		    expect(profile.username).toEqual('user');
		    expect(profile.displayName).toEqual('John Doe');
		    expect(profile.roles).toEqual([{ id: 'seller', name: 'seller' }]);
		    expect(profile.issuerDid).toEqual('did:example:issuer');
		    expect(profile.idpId).toEqual('did:example:issuer');
		    expect(profile._json).toEqual(vcClaims);
		    expect(profile.organizations).toEqual([{
			id: 'did:example:issuer',
			name: 'did:example:issuer',
			roles: [
			    { name: 'Seller', id: 'Seller' },
			    { name: 'Buyer', id: 'Buyer' },
			    { name: 'orgAdmin', id: 'orgAdmin' }
			]
		    }]);
		});

		userStrategy.setProfileParams(null, vcClaims, 'vc-token', 'vc-refresh');
		userStrategy.loginComplete();
	    });

	    it('should build profile from LEARCredentialEmployee vc field', async () => {
		const vcClaims = {
		    sub: 'did:user:123',
		    vc: {
			type: ['VerifiableCredential', 'LEARCredentialEmployee'],
			issuer: 'did:issuer:123',
			credentialSubject: {
			    mandate: {
				mandatee: {
				    id: 'did:user:123',
				    email: 'john.doe@example.com',
				    first_name: 'John',
				    last_name: 'Doe'
				},
				mandator: {
				    organizationIdentifier: 'org-123',
				    organization: 'Test Org'
				},
				power: [{
				    tmf_function: 'productOffering',
				    tmf_action: ['create', 'update']
				}]
			    }
			}
		    }
		};

		const userStrategy = await builderToTest.buildStrategy((accessToken, refreshToken, profile, cbDone) => {
		    expect(accessToken).toEqual('lear-token');
		    expect(refreshToken).toEqual('lear-refresh');
		    expect(profile.id).toEqual('did:user:123');
		    expect(profile.email).toEqual('john.doe@example.com');
		    expect(profile.username).toEqual('john.doe');
		    expect(profile.displayName).toEqual('John Doe');
		    expect(profile.issuerDid).toEqual('did:issuer:123');
		    expect(profile.idpId).toEqual('did:issuer:123');
		    expect(profile._json).toEqual(vcClaims);
		    expect(profile.organizations).toEqual([{
			id: 'org-123',
			name: 'Test Org',
			roles: [{ id: 'Seller', name: 'Seller' }]
		    }]);
		});

		userStrategy.setProfileParams(null, vcClaims, 'lear-token', 'lear-refresh');
		userStrategy.loginComplete();
	    });

	    it('should build profile from LEARCredentialEmployee verifiableCredential field', async () => {
		const vcClaims = {
		    sub: 'did:user:456',
		    verifiableCredential: {
			type: ['VerifiableCredential', 'LEARCredentialEmployee'],
			issuer: 'did:issuer:456',
			credentialSubject: {
			    mandate: {
				mandatee: {
				    id: 'did:user:456',
				    email: 'jane.smith@example.com',
				    first_name: 'Jane',
				    last_name: 'Smith'
				},
				mandator: {
				    organizationIdentifier: 'org-456',
				    organization: 'Other Org'
				},
				power: [{
				    tmf_function: 'Onboarding',
				    tmf_action: 'execute'
				}]
			    }
			}
		    }
		};

		const userStrategy = await builderToTest.buildStrategy((accessToken, refreshToken, profile, cbDone) => {
		    expect(profile.id).toEqual('did:user:456');
		    expect(profile.email).toEqual('jane.smith@example.com');
		    expect(profile.username).toEqual('jane.smith');
		    expect(profile.displayName).toEqual('Jane Smith');
		    expect(profile.issuerDid).toEqual('did:issuer:456');
		    expect(profile.organizations).toEqual([{
			id: 'org-456',
			name: 'Other Org',
			roles: [{ id: 'orgAdmin', name: 'orgAdmin' }]
		    }]);
		});

		userStrategy.setProfileParams(null, vcClaims, 'lear-token-2', 'lear-refresh-2');
		userStrategy.loginComplete();
	    });

	    it('should fall back to OIDC profile when claims have no VC structure', async () => {
		const oidcClaims = {
		    sub: 'user-sub-123',
		    preferred_username: 'testuser',
		    name: 'Test User'
		};

		const userStrategy = await builderToTest.buildStrategy((accessToken, refreshToken, profile, cbDone) => {
		    expect(profile.id).toEqual('user-sub-123');
		    expect(profile.username).toEqual('testuser');
		    expect(profile.displayName).toEqual('Test User');
		    expect(profile.roles).toEqual([{ name: 'seller', id: 'seller' }]);
		    expect(profile.organizations).toEqual([]);
		});

		userStrategy.setProfileParams(null, oidcClaims, 'oidc-token', 'oidc-refresh');
		userStrategy.loginComplete();
	    });
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
