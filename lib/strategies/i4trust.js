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

const Strategy = require('passport-i4trust').Strategy
const nodeConfig = require('../../config');


function strategy (config) {
    function buildProfile(profile) {
        if (!profile.id) {
            profile.id = profile._json.sub;
        }

        if (!profile.email) {
            profile.email = profile._json.email;
        }

        profile.organizations = [{
            id: config.idpId,
            name: config.idpId,
            roles: [{
                'name': nodeConfig.oauth2.roles.seller,
                'id': nodeConfig.oauth2.roles.seller
            }, {
                'name': nodeConfig.oauth2.roles.customer,
                'id': nodeConfig.oauth2.roles.customer
            }, {
                'name': nodeConfig.oauth2.roles.orgAdmin,
                'id': nodeConfig.oauth2.roles.orgAdmin
            }]
        }];

        profile.roles = [{
            'name': nodeConfig.oauth2.roles.seller,
            'id': nodeConfig.oauth2.roles.seller
        }];
    }

    async function buildStrategy(callback) {
        let params  = {
            clientID: config.clientID,
            callbackURL: config.callbackURL,
            serverURL: config.server,
            idpId: config.idpId,
            tokenKey: config.tokenKey,
            tokenCrt: config.tokenCrt
        };

        const userStrategy = new Strategy(params, (accessToken, refreshToken, profile, done) => {
            console.log(profile);
            buildProfile(profile);

            return callback(accessToken, refreshToken, profile, done);
        });

        userStrategy._auxUserProfile = userStrategy.userProfile
        userStrategy.userProfile = function(accessToken, done) {
            userStrategy._auxUserProfile(accessToken, (err, profile) => {
                if (err) {
                    return done(err, profile);
                }

                buildProfile(profile);
                done(null, profile);
            });
        };
        return userStrategy;
    }

    function getScope() {
        return ['jwt', 'openid', 'iSHARE', 'email', 'profile'];
    }

    return {
        buildStrategy: buildStrategy,
        getScope: getScope
    }
}

exports.strategy = strategy;
