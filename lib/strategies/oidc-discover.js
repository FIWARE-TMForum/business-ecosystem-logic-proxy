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

const { Issuer, Strategy, generators } = require('openid-client');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const nodeConfig = require('../../config');
const { VerifiableCredential } = require('./passport-vc');
const logger = require('../logger').logger.getLogger('Auth');

function strategy (config) {

    function buildProfile(profile) {

	// try to build from vc
	try {
		const vc = new VerifiableCredential(profile);
		return vc.getProfile();
	} catch (error) {
		logger.debug(`Profile is not a VC ${profile}`, error)
	}
	// Set ID
	if (!profile.id) {
	    if (profile.sub) {
		profile.id = profile.sub;
	    } else if (profile.preferred_username) {
		profile.id = profile.preferred_username;
	    }
        }

	// Set displayName
	if (!profile.displayName) {
	    if (profile.name) {
		profile.displayName = profile.name;
	    } else if (profile.preferred_username) {
		profile.displayName = profile.preferred_username;
	    } else if (profile.username) {
		profile.displayName = profile.username;
	    }
	}

	// Set username
	if (!profile.username) {
	    if (profile.preferred_username) {
		profile.username = profile.preferred_username;
	    }
	}

	// Organizations
	if (!profile.organizations) {
	    profile.organizations = [];
	}

	// Roles
	if (!profile.roles) {
	    if (config.defaultRole) {
		profile.roles = [{
		    'name': config.defaultRole,
		    'id': config.defaultRole
		}];
	    } else {
		profile.roles = [{
		    'name': nodeConfig.roles.seller,
		    'id': nodeConfig.roles.seller
		}];
	    }
	}
	return profile;
    }

    async function buildStrategy(callback) {
	// Set discovery URI
	let discoveryURI = config.server;
	if (config.oidcDiscoveryURI) {
	    discoveryURI = config.oidcDiscoveryURI;
	}

	// Get issuer
	const oidcIssuer = await Issuer.discover(discoveryURI);
	var client = new oidcIssuer.Client({
	    client_id: config.clientID,
	    client_secret: config.clientSecret,
	    redirect_uris: [ config.callbackURL ],
	    token_endpoint_auth_method: config.oidcTokenEndpointAuthMethod
	});

	// Create strategy
	const params = {}
	if (nodeConfig.oauth2.nonce) {
		params.nonce = generators.nonce()
	}
	const userStrategy = new Strategy({ client, params }, (tokenSet, done) => {
	    const profile = buildProfile(tokenSet.claims());
	    return callback(tokenSet.access_token, tokenSet.refresh_token, profile, done);
	});

	userStrategy.userProfile = function(accessToken, done) {
		const JWKS = createRemoteJWKSet(new URL(client.issuer.metadata.jwks_uri));
		jwtVerify(accessToken, JWKS, { issuer: client.issuer.issuer }).then(({ payload }) => {
			const profile = buildProfile(payload);
			done(null, profile);
		}).catch((err) => {
			logger.debug('Failed to verify access token signature', err);
			done(err);
		});
	}
	return userStrategy;

    }

    function getScope() {
	return config.oidcScopes;
    }

    return {
        buildStrategy: buildStrategy,
        getScope: getScope
    }

}

exports.strategy = strategy;

