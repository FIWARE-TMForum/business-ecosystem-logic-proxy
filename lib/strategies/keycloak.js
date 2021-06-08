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

const KeyCloakStrategy = require('passport-keycloak-oauth2-oidc').Strategy;

function strategy (config) {
    function buildStrategy(callback) {

        let authEndpoint = config.server;
        if (!authEndpoint.endsWith('/')) {
            authEndpoint += '/'
        }

        const params = {
            clientID: config.clientID,
            realm: config.realm,
            publicClient: 'false',
            clientSecret: config.clientSecret,
            sslRequired: 'none',
            authServerURL: authEndpoint + 'auth',
            callbackURL: config.callbackURL
        }

        return new KeyCloakStrategy(params, (accessToken, refreshToken, profile, done) => {

            profile['_json'].username = profile.username;

            profile.displayName = profile.name;
            profile['_json'].displayName = profile.displayName;

            profile.organizations = [];
            profile.roles = [];

            if (profile._json.resource_access != null && profile._json.resource_access.bae != null) {
                profile.roles = profile._json.resource_access.bae.roles.map((role) => {
                    return {
                        id: role,
                        name: role
                    }
                });
            }

            return callback(accessToken, refreshToken, profile, done);
        });
    }

    function getScope() {
        return ['profile'];
    }
    return {
        buildStrategy: buildStrategy,
        getScope: getScope
    }
}

exports.strategy = strategy;