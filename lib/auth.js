/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
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

var async = require('async'),
    config = require('../config'),
    FIWAREStrategy = require('passport-fiware-oauth').OAuth2Strategy,
    logger = require('./logger').logger.getLogger("Server"),
    party = require('./party'),
    TokenService = require('../db/schemas/tokenService'),
    utils = require('./utils');

var auth = (function () {
    var tokensCache = {};

    var FIWARE_STRATEGY = new FIWAREStrategy({
        clientID: config.oauth2.clientID,
        clientSecret: config.oauth2.clientSecret,
        callbackURL: config.oauth2.callbackURL,
        serverURL: config.oauth2.server
    }, function (accessToken, refreshToken, profile, done) {
        profile['accessToken'] = accessToken;
        profile['refreshToken'] = refreshToken;
        profile['expire'] = Date.now() + 3600000;

        // Save
        TokenService.update(
            { userId: profile.id },
            { authToken: accessToken, refreshToken: refreshToken, expire: profile['expire'] },
            { upsert: true, setDefaultsOnInsert: true },
            function (err) {
                if (err) {
                    done(err);
                } else {
                    done(null, profile);
                }
            });
    });

    // Replace userProfile function to check
    FIWARE_STRATEGY._userProfile = FIWARE_STRATEGY.userProfile;

    FIWARE_STRATEGY.userProfile = function(authToken, callback) {

        if (tokensCache[authToken] && (tokensCache[authToken].expire - Date.now() >= 5000)) {
            logger.debug('Using cached token for user ' +  tokensCache[authToken].id);
            callback(null, tokensCache[authToken]);
        } else {
            FIWARE_STRATEGY._userProfile(authToken, function(err, userProfile) {
                if (err) {
                    callback(err);
                } else {
                    logger.debug('Token for user ' + userProfile.id + ' stored');

                    if (!userProfile.expire) {
                        // If the profile does not have an expire field means that the request comes from the
                        // API, not from the portal
                        userProfile.expire = Date.now() + 1800000;
                    }

                    tokensCache[authToken] = userProfile;
		    tokensCache[authToken].orgProcessed = false;
		    tokensCache[authToken].orgProcessing = false;
                    callback(err, userProfile);
                }
            });
        }
    };

    var headerAuthentication = function(req, res, next) {
        var askUserToken = function (token, end) {
            FIWARE_STRATEGY.userProfile(token, (err, userProfile) => {
                if (err) {
                    utils.log(logger, 'warn', req, 'Token ' + token + ' invalid');
                    utils.sendUnauthorized(res, 'invalid auth-token');
                } else {
                    if (userProfile.appId !== config.oauth2.clientID) {
                        utils.log(logger, 'warn', req, 'Token ' + token + ' is from a different app');
                        if (end) {
                            utils.sendUnauthorized(res, 'It has not been possible to obtain your user info. Have you authorized this app to access your info?');
                        } else {
                            sameToken(token, userProfile.id, () => {
                                askUserToken(token, true);
                            });
                        }
                    } else {
                        req.user = userProfile;
                        req.user.accessToken = token;
                        next();
                    }
                }
            });
        };

        // If the user is already logged, this is not required...
        if (!req.user) {

            try {
                var authToken = utils.getAuthToken(req.headers);
                askUserToken(authToken, false);

            } catch (err) {

                if (err.name === 'AuthorizationTokenNotFound') {
                    utils.log(logger, 'info', req, 'request without authentication');
                    next();
                } else {
                    utils.log(logger, 'warn', req, err.message);
                    utils.sendUnauthorized(res, err.message);
                }
            }

        } else {
            next();
        }
    };

    var checkOrganizations = function(req, res, next){
	
	if (!req.user || tokensCache[req.user.accessToken].orgProcessed || tokensCache[req.user.accessToken].orgProcessing){
	    next();
	} else {
	    tokensCache[req.user.accessToken].orgProcessing = true;
	    async.waterfall([ // here should be a list of functions
		function(callback){
		    party.getOrganizations((err, resp) => {
			if (err) {
			    callback(err);
			}
			var organizations = JSON.parse(resp.body);
			var finalRoles = {"relatedParty": []}
			var concatRoles = function(newRoles, oldRoles){
			    oldRoles.relatedParty = oldRoles.relatedParty.concat(newRoles)
			    return oldRoles
			}
			req.user.organizations.forEach((element, index, array) => {
			    var existsInd = organizations.findIndex((el, ind, arr) => {
				return element.id === el.id });
			    if (existsInd === -1) {
				var content = {
				    'id': element.id,
				    'tradingName': element.name
				};
				party.createOrganization(content, (err, res) => {
				    if (err) {
					callback(err);
				    } else {
					var org = JSON.parse(res.body)
					finalRoles = concatRoles({
					    'id': org.id,
					    'name': org.tradingName,
					    'href': org.href,
					    'role': element.roles.map(rol => rol.name).join(',')
					}, finalRoles);
				    }
				});
			    } else {
				// We create the new relatedParty field of the user
				finalRoles = concatRoles({
				    'id': element.id,
				    'name': element.name,
				    'href': organizations[existsInd].href,
				    'role': element.roles.map(rol => rol.name).join(',')
				}, finalRoles);
			    }
			});
			callback(null, finalRoles);
		    });
		},
		function(finalRoles, callback){
		    party.updateIndividual(req.user.id, finalRoles, callback);
		}
	    ], (err, result) => {
		if (err){
		    utils.log(logger, 'warn', req, err.message)
		} else {
		    tokensCache[req.user.accessToken].orgProcessed = true;
		    tokensCache[req.user.accessToken].orgProcessing = false;
		}
		next();
	    });
	}
    };
    
    // Refresh token & update data in db
    var refreshToken = function refreshToken(id, refreshToken, cb) {
        FIWARE_STRATEGY._oauth2.getOAuthAccessToken(refreshToken, { grant_type: "refresh_token" }, (err, authToken, newRefresh) => {
            if (err) {
                cb(err);
            } else {
                TokenService.update(
                    { userId: id },
                    { authToken: authToken, refreshToken: newRefresh, expire: Date.now() + 3600000 },
                    () => {
                        cb(err, authToken, newRefresh);
                    }
                );
            }
        });
    };

    var refresh = function refresh(data, cb) {
        refreshToken(data.userId, data.refreshToken, (err, authToken) => {
            if (err) {
                cb(err);
            } else {
                FIWARE_STRATEGY.userProfile(authToken, (err) => cb(err, authToken));
            }
        });
    };

    var askProfileOrRefresh = function askProfileOrRefresh(data, cb) {
        if (data.expire - Date.now() <= 5000) {
            refresh(data, cb);
        } else {
            FIWARE_STRATEGY.userProfile(data.authToken, (err) => {
                // If err, refresh && ask again
                if (err) {
                    refresh(data, cb);
                } else {
                    cb(err, data.authToken);
                }
            });
        }
    };

    var sameToken = function (authToken, id, cb) {
        var refreshHandler = function (err, token) {
            if (!err) {
                tokensCache[authToken] = tokensCache[token];
            }

            cb();
        };

        TokenService.findOne({ userId: id }, (err, data) => {
            if (!err) {
                if (!tokensCache[data.authToken]) {
                    // The token is not in the cache
                    askProfileOrRefresh(data, refreshHandler);
                    return;
                } else if (tokensCache[data.authToken].expire - Date.now() <= 5000) {
                    // The token is in the cache but it is expired
                    // Drop the old userinfo data to avoid a memory leak
                    delete tokensCache[data.authToken];
                    refresh(data, refreshHandler);
                } else {
                    // The token is in the cache and its still valid
                    tokensCache[authToken] = tokensCache[data.authToken];
                    cb();
                }
            } else {
                cb();
            }
        });
    };

    var getCache = function () {
        return tokensCache;
    };

    return {
        headerAuthentication: headerAuthentication,
	checkOrganizations: checkOrganizations,
        FIWARE_STRATEGY: FIWARE_STRATEGY,
        getCache: getCache
    };

})();

exports.auth = auth;
