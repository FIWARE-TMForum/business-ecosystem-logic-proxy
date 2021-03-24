/* Copyright (c) 2015 - 2018 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2021 Future Internet Consulting and Development Solutions S.L.
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

const async = require('async');
const logger = require('./logger').logger.getLogger("Server");
const moment =  require('moment');
const party = require('./party').partyClient;
const Promise = require('promiz');
const utils = require('./utils');
const nodeConfig = require('../config');

const LRU = require('lru-cache');

const options = {
    max: 50,
    maxAge: 1000 * 60 * 120 // 2 hour
}

const cache = new LRU(options);

const orgsEnum = {PENDING: 1, PROCESSING: 2, PROCESSED: 3};


function auth (config) {

    // Load IDP providers
    let strategy;
    if (config.provider == 'fiware') {
        strategy = require('./strategies/fiware').strategy(config);
    } else if (config.provider == 'keycloak') {
        strategy = require('./strategies/keycloak').strategy(config);
    } else if (config.provider == 'i4trust') {
        strategy = require('./strategies/i4trust').strategy(config);
    } else if (config.provider == 'github') {
        strategy = require('./strategies/github').strategy(config);
    }

    const buildStrategy = strategy.buildStrategy;
    const getScope = strategy.getScope;

    const STRATEGY = buildStrategy((accessToken, refreshToken, profile, done) => {
        profile['accessToken'] = accessToken;
        profile['refreshToken'] = refreshToken;

        // Check if exp info is included with the profile
        if (!profile['expire']) {
            profile['expire'] = moment().unix() + 3600;
        }

        let idp = 'local';
        if (config.idpId) {
            idp = config.idpId;
        }

        if (!profile.displayName) {
            profile.displayName = profile.username;
        }

        profile['idp'] = idp;
        profile.orgState = orgsEnum.PENDING;

        cache.set(accessToken, profile);
        done(null, profile);
    });

    // Override userprofile method to support token cache
    STRATEGY._userProfile = STRATEGY.userProfile;
    STRATEGY.userProfile = function(authToken, callback) {

        const profile = cache.get(authToken);
        if (profile && (profile.expire - moment().unix() >= 5)) {
            logger.debug('Using cached token for user ' + profile.id);
            callback(null, profile);
        } else {
            STRATEGY._userProfile(authToken, function(err, userProfile) {
                if (err) {
                    callback(err);
                } else {
                    logger.debug('Token for user ' + userProfile.id + ' stored');

                    if (!userProfile.expire) {
                        // If the profile does not have an expire field means that the request comes from the
                        // API, not from the portal
                        if (userProfile._json && userProfile._json.exp) {
                            userProfile.expire = userProfile._json.exp;
                        } else {
                            userProfile.expire = moment().unix() + 1800;
                        }
                    }

                    userProfile.orgState = orgsEnum.PENDING;
                    cache.set(authToken, userProfile);

                    callback(err, userProfile);
                }
            });
        }
    };

    return {
        STRATEGY: STRATEGY,
        getScope: getScope
    };
};


function authMiddleware (idps) {

    const refresh = function refresh(profile, cb) {
        const userStrategy = idps[profile.idp];

        userStrategy._oauth2.getOAuthAccessToken(refreshToken, { grant_type: "refresh_token" }, (err, authToken, newRefresh) => {
            if (err) {
                cb(err);
            } else {
                userStrategy.userProfile(authToken, (err, userProfile) => {
                    userProfile.accessToken = accessToken;
                    userProfile.refreshToken = newRefresh;

                    // Check if exp info is included with the profile
                    if (!userProfile.expire) {
                        userProfile.expire = moment().unix() + 3600;
                    }

                    if (!userProfile.username) {
                        userProfile.username = profile.username;
                    }

                    if (!userProfile.displayName) {
                        userProfile.displayName = userProfile.username;
                    }

                    userProfile.idp = profile.idp;
                    userProfile.orgState = orgsEnum.PENDING;

                    // Save new profile
                    cache.set(authToken, userProfile);
                    cb(err, authToken, userProfile)
                });
            }
        });
    };

    const askProfileOrRefresh = function askProfileOrRefresh(profile, cb) {
        if (profile.expire - moment().unix() <= 5) {
            refresh(profile, cb);
        } else {
            // No need 
            cb(null, profile.accessToken, profile);
        }
    };

    const headerAuthentication = function(req, res, next) {
        const askUserToken = function (token) {
            // Look for the IDP the user belongs to
            // The user needed to log in previously, so it must be cached
            const profile = cache.get(token);

            if (!profile) {
                utils.sendUnauthorized(res, 'It has not been possible to obtain your user info');
            }

            askProfileOrRefresh(profile, (err, accessToken, userProfile) => {
                if (err) {
                    return utils.sendUnauthorized(res, 'It has not been possible to obtain your user info');
                }

                console.log(userProfile);

                req.user = userProfile;
                req.user.username = userProfile.username;

                if (userProfile.displayName) {
                    req.user.displayName = userProfile.displayName;
                } else {
                    req.user.displayName = userProfile.username;
                }

                req.user.accessToken = accessToken;
                next();
            });
        };

        // If the user is already logged, this is not required...
        if (!req.user) {
            try {
                const authToken = utils.getAuthToken(req.headers);
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

    const setPartyObj = function (req, res, next) {
        if (!req.user) {
            next();
        } else {
            const orgId = (req.headers && req.headers['x-organization']) ? req.headers['x-organization'] : '';
            const org = req.user.organizations ? req.user.organizations.find( x => x.id === orgId) : undefined;

            if (!org && orgId != ''){
                utils.sendUnauthorized(res, 'You are not allowed to act on behalf the provided organization');
            } else {
                let orgTemplate = {};
                if (org) {
                    // Build an organization profile as req.user object
                    orgTemplate.userNickname = req.user.id;
                    orgTemplate.id = org.id;
                    orgTemplate.roles = org.roles;
                    orgTemplate.displayName = org.name;
                    orgTemplate.accessToken = req.user.accessToken;
                    orgTemplate.refreshToken = req.user.refreshToken;
                    orgTemplate.email = org.id + '@emailnotusable.com';
                    orgTemplate.idp = req.user.idp;
                }
                req.user = (req.headers && req.headers['x-organization'] && orgTemplate.id) ? orgTemplate : req.user;

                next();
            }
        }
    };

    const checkOrganizations = function(req, res, next){
        const concatRoles = function(newRoles, oldRoles){
            oldRoles.relatedParty = oldRoles.relatedParty.concat(newRoles);
            return oldRoles
        };

        const buildOrganization = function(element, finalRoles, callback) {
            const concatOrgRoles = function (res) {
                const org = JSON.parse(res.body);
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

        if (!req.user){
            next();
        } else {
            const profile = cache.get(req.user.accessToken);
            if (profile.orgState != orgsEnum.PENDING) {
                return next();
            }

            let finalRoles = {"relatedParty": []};
            profile.orgState = orgsEnum.PROCESSING;
            cache.set(req.user.accessToken, profile);

            async.waterfall([
                function(callback){
                    party.getIndividual(req.user.id, (err) => {
                        if (err && err.status == 404) {
                            // Create the individual if it does not exists
                            const user = {
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
                                user.familyName = req.user.username;
                                user.givenName = req.user.username;
                            }

                            party.createIndividual(user, (err) => {
                                if (err) {
                                    console.log(err);
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
                    let promise = Promise.resolve();

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
                    profile.orgState = orgsEnum.PENDING;
                    cache.set(req.user.accessToken, profile);

                    let message = err.message;
                    if (typeof message != 'string') {
                        message = JSON.stringify(message)
                    }
                    utils.sendUnexpectedError(res, 'Unexpected Error: ' + message);

                } else {
                    // Organization info for the current access token has been processed and cached
                    profile.orgState = orgsEnum.PROCESSED;
                    cache.set(req.user.accessToken, profile);

                    next();
                }
            });
        }
    };

    const getCache = function () {
        return tokensCache;
    };

    return {
        headerAuthentication: headerAuthentication,
        checkOrganizations: checkOrganizations,
        setPartyObj: setPartyObj,
        getCache: getCache,
    }
}

exports.auth = auth;
exports.authMiddleware = authMiddleware;
