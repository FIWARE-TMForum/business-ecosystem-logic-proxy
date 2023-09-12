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
const jwt = require('jsonwebtoken');
const proxyConfig = require('../../config');
const party = require('../party').partyClient;

function strategy (config) {

    function getRawProfile(accessToken) {
        return jwt.decode(accessToken);
    }

    async function buildStrategy(callback) {

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
            authServerURL: authEndpoint,
            callbackURL: config.callbackURL
        }

        const populateProfile = (accessToken, profile, cb) => {
            const rawProfile = getRawProfile(accessToken);

            profile['_json'].username = profile.username;

            profile.displayName = profile.name;
            profile['_json'].displayName = profile.displayName;

            profile.organizations = [];
            profile.roles = [];

            // Roles are not being properly loaded by the strategy, get them from the access token
            if (rawProfile.resource_access != null && rawProfile.resource_access[params.clientID] != null) {
                profile.roles = rawProfile.resource_access[params.clientID].roles.map((role) => {
                    return {
                        id: role,
                        name: role
                    }
                });
            }

            // Groups are not properly managed by the strategy so get them from the token
            if (rawProfile.groups != null) {
                const orgPromises = rawProfile.groups.map(async (group) => {
                    // Groups only manage name field, to have a different ID and trading name
                    // it is possible to do it directly in the market, we need to check if the organization
                    // is already registered and pick the trading name
                    let tradingName = group;
                    await new Promise((resolve, reject) => {
                        party.getOrganization(group, (err, res) => {
                            if (!err) {
                                const org = JSON.parse(res.body);
                                tradingName = org.tradingName;
                            }
                            resolve();
                        });
                    });

                    return {
                        id: group,
                        name: tradingName,
                        roles: [{
                            name: proxyConfig.oauth2.roles.seller
                        }, {
                            name: proxyConfig.oauth2.roles.customer
                        }, {
                            name: proxyConfig.oauth2.roles.orgAdmin
                        }]
                    }
                });

                Promise.all(orgPromises).then(values => {
                    profile.organizations = values;
                    return cb(profile);
                })
            } else {
                // Organizations -> id, name, roles
                return cb(profile);
            }
        };

        const strategyClass = new KeyCloakStrategy(params, (accessToken, refreshToken, profile, done) => {
            populateProfile(accessToken, profile, (updatedProfile) => {
                return callback(accessToken, refreshToken, updatedProfile, done);
            });
        });

        //
        // Override userprofile methods to fill the proper info always and not only on login
        strategyClass.__userProfile = strategyClass.userProfile;

        const buildUserProfile = (accessToken, cb) => {
            strategyClass.__userProfile(accessToken, (err, userProfile) => {
                if (err) {
                    return cb(err, userProfile);
                }

                populateProfile(accessToken, userProfile, (updatedProfile) => {
                    return cb(null, updatedProfile);
                });
            });
        }

        strategyClass.userProfile = buildUserProfile;

        return strategyClass;
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
