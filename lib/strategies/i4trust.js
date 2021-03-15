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

const config = require('../../config');
const Strategy = require('./passport-i4trust/lib/passport-i4trust').Strategy
//const Strategy = require('passport-i4trust').OAuth2Strategy;


function buildStrategy(callback) {
    let params  = {
        clientID: config.oauth2.clientID,
        callbackURL: config.oauth2.callbackURL,
        serverURL: config.oauth2.server,
        key: config.oauth2.key,
        idpId: config.oauth2.idpId,
        tokenKey: config.oauth2.tokenKey,
        tokenCrt: config.oauth2.tokenCrt
    };

    return new Strategy(params, (accessToken, refreshToken, profile, done) => {
        console.log(accessToken);
        profile.id = profile.sub;
        if (profile.organizations == null) {
            profile.organizations  = [];
        }
        profile.roles = [{
            'name': 'seller',
            'id':' seller'
        }];
        return callback(accessToken, refreshToken, profile, done);
    });
}

function getScope() {
    return ['jwt', 'openid', 'iSHARE'];
}

exports.buildStrategy = buildStrategy;
exports.getScope = getScope;
