/* Copyright (c) 2022 Future Internet Consulting and Development Solutions S.L.
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

const AIMarketStrategy = require('passport-fiware-oauth').OAuth2Strategy;


function strategy (config) {

    function buildProfile(profile) {
        if (!profile['expire'] && profile._json && profile._json.exp) {
            console.log("From _json");
            profile['expire'] = profile._json.exp;
        }

        if (!profile.username) {
            profile.username = profile._json.username;
        }

        if (!profile.displayName && profile._json.displayName) {
            profile.displayName = profile._json.displayName;
        }

        if (!profile.displayName && !profile._json.displayName) {
            profile.displayName = profile.username;
        }

        if (profile._json.given_name) {
            profile.givenName = profile._json.given_name;
        }

        if (profile._json.family_name) {
            profile.familyName = profile._json.family_name;
        }

	    // Default role
        if ((!profile.roles || profile.roles === undefined || profile.roles.length == 0) && config.defaultRole) {
	        profile.roles = [{
		    'name': config.defaultRole,
		    'id': config.defaultRole
	        }];
	    }

        if (profile.extra) {
            if (profile.extra.gender != null && profile.extra.gender.length > 0) {
                profile.gender = profile.extra.gender;
            }

            if (profile.extra.academicTitle != null && profile.extra.academicTitle.length > 0) {
                profile.academicTitle = profile.extra.academicTitle;
            }

            if (profile.extra.language != null && profile.extra.language.length > 0) {
                profile.language = profile.extra.language;
            }

            if (profile.extra.pictureUrl != null && profile.extra.pictureUrl.length > 0) {
                profile.pictureUrl = profile.extra.pictureUrl;
            }
        }
    }

    async function buildStrategy(callback) {
        let params  = {
            clientID: config.clientID,
            clientSecret: config.clientSecret,
            callbackURL: config.callbackURL,
            serverURL: config.server
        };

        if (config.oidc) {
            params.key = config.key;
        }

        const userStrategy = new AIMarketStrategy(params, (accessToken, refreshToken, profile, done) => {
            // Check if exp info is included with the profile
            buildProfile(profile);

            console.log(profile);
            console.log(accessToken);
            // TODO: CHECK USERNAME AND DISPLAY NAME
            // CHECK expire field is date and not time
            callback(accessToken, refreshToken, profile, done);
        });

        // Need to make profile updates every time userProfile is called
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
        if (config.oidc) {
            return ['jwt'];
        } else {
            return ['all_info']
        }
    }
    return {
        buildStrategy: buildStrategy,
        getScope: getScope
    }
}

exports.strategy = strategy;
