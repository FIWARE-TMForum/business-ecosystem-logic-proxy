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

const GithubStrategy = require('passport-github').Strategy;

function strategy (config) {
    function buildStrategy(callback) {
        const params = {
            clientID: config.clientID,
            clientSecret: config.clientSecret,
            callbackURL: config.callbackURL
        }
        return new GithubStrategy(params, (accessToken, refreshToken, profile, done) => {
            profile.organizations = [];
            profile.roles = [{
                'name': 'seller',
                'id':' seller'
            }];
            profile.email = profile._json.email;

            return callback(accessToken, refreshToken, profile, done);
        });
    }

    function getScope() {
        return ['user:email'];
    }

    return {
        buildStrategy: buildStrategy,
        getScope: getScope
    }
}

exports.strategy = strategy;
