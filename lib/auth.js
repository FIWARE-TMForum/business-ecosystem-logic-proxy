/* Copyright (c) 2015 - 2018 CoNWeT Lab., Universidad Politécnica de Madrid
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
    party = require('./party').partyClient,
    Promise = require('promiz'),
    TokenService = require('../db/schemas/tokenService'),
    utils = require('./utils');

function auth () {
    var tokensCache = {};
    var orgsEnum = {PENDING: 1, PROCESSING: 2, PROCESSED: 3};

    var FIWARE_STRATEGY = new FIWAREStrategy({
        clientID: config.oauth2.clientID,
        clientSecret: config.oauth2.clientSecret,
        callbackURL: config.oauth2.callbackURL,
        serverURL: config.oauth2.server,
        isLegacy: config.oauth2.isLegacy
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
                    tokensCache[authToken].orgState = orgsEnum.PENDING;
                    callback(err, userProfile);
                }
            });
        }
    };

    var setPartyObj = function (req, res, next) {
        if (!req.user) {
            next();
        } else {
            var orgId = (req.headers && req.headers['x-organization']) ? req.headers['x-organization'] : '';
            var org = req.user.organizations ? req.user.organizations.find( x => x.id === orgId) : undefined;

            if (!org && orgId != ''){
                utils.sendUnauthorized(res, 'You are not allowed to act on behalf the provided organization');
            } else {
                var orgTemplate = {};
                if (org) {
                    // Build an organization profile as req.user object
                    orgTemplate.userNickname = req.user.id;
                    orgTemplate.id = org.id;
                    orgTemplate.roles = org.roles;
                    orgTemplate.displayName = org.name;
                    orgTemplate.accessToken = req.user.accessToken;
                    orgTemplate.refreshToken = req.user.refreshToken;
                    orgTemplate.email = org.id + '@emailnotusable.com';
                }
                req.user = (req.headers && req.headers['x-organization'] && orgTemplate.id) ? orgTemplate : req.user;

                next();
            }
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
                        req.user.username = userProfile._json.username;
                        req.user.displayName = userProfile._json.username;
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
        var concatRoles = function(newRoles, oldRoles){
            oldRoles.relatedParty = oldRoles.relatedParty.concat(newRoles);
            return oldRoles
        };

        var buildOrganization = function(element, finalRoles, callback) {
            var concatOrgRoles = function (res) {
                var org = JSON.parse(res.body);
                finalRoles = concatRoles({
                    'id': org.id,
                    'name': org.tradingName,
                    'href': org.href,
                    'role': element.roles.map(role => role.name).join(',')
                }, finalRoles);

                callback(null);
            };

            party.getOrganization(element.id, (err, res) => {
                if (err && err.status == '404') {
                    var content = {
                        'id': element.id,
                        'tradingName': element.name
                    };
                    party.createOrganization(content, (err, res) => {
                        if (err) {
                            callback(err);
                        } else {
                            concatOrgRoles(res);
                        }
                    });

                } else if (err) {
                    callback(err);

                } else {
                    concatOrgRoles(res);
                }
            });
        };

        if (!req.user || tokensCache[req.user.accessToken].orgState != orgsEnum.PENDING){
            next();
        } else {
            var finalRoles = {"relatedParty": []};
            tokensCache[req.user.accessToken].orgState = orgsEnum.PROCESSING;

            async.waterfall([
                function(callback){
                    party.getIndividual(req.user.id, (err) => {
                        if (err && err.status == 404) {
                            // Create the individual if it does not exists
                            var user = {
                                id: req.user.id,
                                birthDate: '',
                                contactMedium: [],
                                countryOfBirth: '',
                                familyName: req.user.displayName,
                                gender: '',
                                givenName: req.user.displayName,
                                maritalStatus: '',
                                nationality: '',
                                placeOfBirth: '',
                                title: ''
                            };
                            if (req.user.displayName === "") {
                                user.familyName = req.user._json.username;
                                user.givenName = req.user._json.username;
                            }
                            party.createIndividual(user, (err) => {
                                if (err) {
                                    callback(err);
                                } else {
                                    callback(null);
                                }
                            });
                        } else if(err) {
                            callback(err);
                        } else {
                            callback(null);
                        }
                    });
                },
                function(callback) {
                    var promise = Promise.resolve();

                    // Serialize organization processing
                    req.user.organizations.forEach((element) => {
                        promise = promise.then(() => {
                            var p = new Promise();
                            buildOrganization(element, finalRoles, (err) => {
                                if (err) {
                                    p.reject(err);
                                } else {
                                    p.resolve();
                                }
                            });
                            return p;
                        });
                    });

                    promise.then(() => {
                        callback(null, finalRoles);
                    }).catch((err) => {
                        callback(err);
                    });

                },
                function(finalRoles, callback) {
                    // Update individual object with new organizations and roles
                    party.updateIndividual(req.user.id, finalRoles, callback);
                }
            ], (err) => {
                if (err){
                    // An error happened processing party info, thus the user request cannot be processed
                    utils.log(logger, 'warn', req, err.message);
                    tokensCache[req.user.accessToken].orgState = orgsEnum.PENDING;
                    utils.sendUnexpectedError(res, 'Unexpected Error: ' + err.message)

                } else {
                    // Organization info for the current access token has been processed and cached
                    tokensCache[req.user.accessToken].orgState = orgsEnum.PROCESSED;
                    next();
                }
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
            if (!err && !!data) {
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
        setPartyObj: setPartyObj,
        FIWARE_STRATEGY: FIWARE_STRATEGY,
        getCache: getCache
    };
    
};

exports.auth = auth;