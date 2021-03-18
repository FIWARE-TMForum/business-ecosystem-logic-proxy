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

const Strategy = require('./passport-i4trust/lib/passport-i4trust').Strategy
//const Strategy = require('passport-i4trust').OAuth2Strategy;


function strategy (config) {
    function buildStrategy(callback) {
        let params  = {
            clientID: config.clientID,
            callbackURL: config.callbackURL,
            serverURL: config.server,
            idpId: config.idpId,
            tokenKey: config.tokenKey,
            tokenCrt: config.tokenCrt
        };

        return new Strategy(params, (accessToken, refreshToken, profile, done) => {
            console.log(profile);
            /*profile.id = profile._json.sub;
            //profile.email = profile._json.email;

            profile._json
            if (profile.organizations == null) {
                profile.organizations = [];
            }
            profile.roles = [{
                'name': 'seller',
                'id':' seller'
            }];*/


            return callback(accessToken, refreshToken, profile, done);
        });
    }

    function getScope() {
        return ['jwt', 'openid', 'iSHARE'];
    }
    return {
        buildStrategy: buildStrategy,
        getScope: getScope
    }
}

exports.strategy = strategy;
