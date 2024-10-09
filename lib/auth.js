/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
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

const logger = require('./logger').logger.getLogger("Server");
const moment = require('moment');
const party = require('./party').partyClient;
const utils = require('./utils');
const nodeConfig = require('../config');

const LRU = require('lru-cache');

const options = {
	max: 50,
	maxAge: 1000 * 60 * 120 // 2 hour
}

const cache = new LRU(options);

const orgsEnum = { PENDING: 1, PROCESSING: 2, PROCESSED: 3 };


const updateUserProfile = function(profile, user) {
	// Populate party
	if (profile.givenName) {
		user.givenName = profile.givenName;
	}

	if (profile.familyName) {
		user.familyName = profile.familyName;
	}

	if (profile.gender) {
		user.gender = profile.gender;
	}

	if (profile.academicTitle) {
		user.partyCharacteristic.push({
			name: 'academicTitle',
			value: profile.academicTitle,
			valueType: 'String'
		});
	}

	if (profile.language) {
		user.partyCharacteristic.push({
			name: 'language',
			value: profile.language,
			valueType: 'String'
		});
	}

	if (profile.pictureUrl) {
		user.partyCharacteristic.push({
			name: 'pictureUrl',
			value: profile.pictureUrl,
			valueType: 'String'
		});
	}
}

const createParty = async function(profile) {
	let partyObj = null;
	const resp = await party.getIndividualsByQuery(`externalReference.name=${profile.id}`);
	const body = resp.body

	if (body.length == 0) {
		const user = {
			birthDate: '',
			contactMedium: [],
			countryOfBirth: '',
			familyName: profile.displayName,
			gender: '',
			givenName: profile.displayName,
			maritalStatus: '',
			nationality: '',
			placeOfBirth: '',
			title: '',
			partyCharacteristic: [],
			externalReference: [
				{
					externalReferenceType: 'idm_id',
					name: profile.id
				}
			]
		}

		// Create the individual if it does not exists
		updateUserProfile(profile, user)

		if (!profile.displayName && (!profile.givenName || !profile.familyName)) {
			user.familyName = profile.username;
			user.givenName = profile.username;
		}

		const createResp = await party.createIndividual(user)
		partyObj = createResp.body
	} else {
		partyObj = body[0]
	}

	return partyObj
}

const concatRoles = function(newRoles, oldRoles) {
	oldRoles.relatedParty = oldRoles.relatedParty.concat(newRoles);
	return oldRoles
};

const buildOrganization = async function(element, finalRoles) {
	console.log('::::::::::::::: ----- ::::::::::::::')
	console.log(finalRoles)

	const concatOrgRoles = function(org) {

		finalRoles = concatRoles({
			'id': org.id,
			'name': org.tradingName,
			'href': org.href,
			'role': element.roles.map(role => role.name).join(',')
		}, finalRoles);
	};

	let res = await party.getOrganizationsByQuery(`externalReference.name=${element.id}`)
	let org;

	if (res.body.length == 0) {
		logger['info']('%s: %s', "Creating new organization", element.id);

		const content = {
			tradingName: element.name,
			externalReference: [
				{
					externalReferenceType: 'idm_id',
					name: element.id
				}
			]
		}

		res = await party.createOrganization(content)
		org = res.body
	} else {
		org = res.body[0]
	}

	concatOrgRoles(org)
	return org.id
};

const createOrganization = async (profile) => {
	console.log('================ CREATING ORG -----')
	let finalRoles = { "relatedParty": [] };

	let parties;
	try {
		console.log(finalRoles)
		console.log(profile.organizations)

		parties = await Promise.all(profile.organizations.map((element) => {
			return buildOrganization(element, finalRoles)
		}));
	} catch (err) {
		logger['warn']('%s: %s', profile.id, err.message);
	}

	if (finalRoles.relatedParty.length > 0) {
		await party.updateIndividual(profile.partyId, finalRoles);
	}

	return parties
}


async function auth(config) {

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
    } else if (config.provider == 'oidc-discover') {
        strategy = require('./strategies/oidc-discover').strategy(config);
    } else if (config.provider == 'aimarket') {
        strategy = require('./strategies/aimarket').strategy(config);
    } else if (config.provider === 'vc') {
        strategy = require('./strategies/vc').strategy(config);
    }

	const buildStrategy = strategy.buildStrategy;
	const getScope = strategy.getScope;

	const STRATEGY = await buildStrategy((accessToken, refreshToken, profile, done) => {
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
        if (config.issuerDid) {
            profile['issuerDid'] = config.issuerDid
        }
        profile.orgState = orgsEnum.PENDING;

		// We need to create the party during login to have the used party ID
		createParty(profile).then((individual) => {
			profile.partyId = individual.id
			return createOrganization(profile)
		}).then((parties) => {
			for (let i = 0; i < profile.organizations.length; i++) {
				profile.organizations[i].partyId = parties[i]
			}

			cache.set(accessToken, profile);
			done(null, profile);
		})
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


function authMiddleware(idps) {

	const refresh = function refresh(profile, cb) {
		const userStrategy = idps[profile.idp].STRATEGY;

		userStrategy._oauth2.getOAuthAccessToken(profile.refreshToken, { grant_type: "refresh_token" }, (err, authToken, newRefresh) => {
			if (err) {
				cb(err);
			} else {
				loadProfile(userStrategy, authToken, newRefresh, profile.idp, cb, profile.partyId, profile.organizations);
			}
		});
	};

	const loadProfile = function loadProfile(userStrategy, authToken, refreshToken, idp, cb, partyId, organizations) {
		userStrategy.userProfile(authToken, (err, userProfile) => {
			userProfile.accessToken = authToken;
			userProfile.refreshToken = refreshToken;
			userProfile.partyId = partyId;

			// Check if exp info is included with the profile
			if (!userProfile.expire) {
				userProfile.expire = moment().unix() + 3600;
			}

			if (!userProfile.displayName) {
				userProfile.displayName = userProfile.username;
			}

			userProfile.idp = idp;
			userProfile.orgState = orgsEnum.PENDING;
			userProfile.organizations = organizations;

			// Save new profile
			cache.set(authToken, userProfile);
			cb(err, authToken, userProfile)
		});
	}

	const askProfileOrRefresh = function askProfileOrRefresh(profile, cb) {
		if (profile.expire - moment().unix() <= 5) {
			refresh(profile, cb);
		} else {
			// No need
			cb(null, profile.accessToken, profile);
		}
	};

	const headerAuthentication = function(req, res, next) {
		const askUserToken = function(token) {
			// Look for the IDP the user belongs to
			const profile = cache.get(token);
			const handleProfile = (err, accessToken, userProfile) => {
				if (err) {
					return utils.sendUnauthorized(res, 'It has not been possible to obtain your user info');
				}

				req.user = userProfile;
				req.user.username = userProfile.username;
				req.user.partyId = userProfile.partyId;

				if (userProfile.displayName) {
					req.user.displayName = userProfile.displayName;
				} else {
					req.user.displayName = userProfile.username;
				}

				req.user.accessToken = accessToken;
				next();
			}

			if (!profile) {
				// It might be an API access, we should be able to process the profile
				// This is only supported for local IDP
				const userStrategy = idps['local'].STRATEGY;
				loadProfile(userStrategy, token, '', 'local', handleProfile, userProfile.partyId, userProfile.organizations)
			} else {
				// Load or refresh the profile in cache
				askProfileOrRefresh(profile, handleProfile);
			}
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

	const setPartyObj = function(req, res, next) {
		if (!req.user) {
			next();
		} else {
			const orgId = (req.headers && req.headers['x-organization']) ? req.headers['x-organization'] : '';
			const org = req.user.organizations ? req.user.organizations.find(x => x.id === orgId) : undefined;

			if (!org && orgId != '') {
				utils.sendUnauthorized(res, 'You are not allowed to act on behalf the provided organization');
			} else {
				let orgTemplate = {};
				if (org) {
					// Build an organization profile as req.user object
					orgTemplate.userNickname = req.user.id;
					orgTemplate.id = org.id;
					orgTemplate.partyId = org.partyId;
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

	const checkOrganizations = async function(req, res, next) {
		if (!req.user) {
			next();
		} else {
			const profile = cache.get(req.user.accessToken);
			if (profile.orgState != orgsEnum.PENDING) {
				return next();
			}

			profile.orgState = orgsEnum.PROCESSING;
			cache.set(req.user.accessToken, profile);

			try {
				// Process individual party
				if (profile.partyId == null) {
					const partyObj = await createParty(req.user)
					console.log('Party Created')
					console.log(partyObj)

					profile.partyId = partyObj.id
				}

				// If editing user profile is disabled, profile must be updated
				if (!nodeConfig.editParty) {
					let user = {
						partyCharacteristic: []
					};

					updateUserProfile(req, user);
					await party.updateIndividual(profile.partyId, user)
				}

				await createOrganization(req.user)
			} catch (err) {
				// An error happened processing party info, thus the user request cannot be processed
				console.log('================ ERROR')
				console.log(err)
				console.log('================')

				utils.log(logger, 'warn', req, err.message);
				profile.orgState = orgsEnum.PENDING;
				cache.set(req.user.accessToken, profile);

				let message = err.message;
				if (typeof message != 'string') {
					message = JSON.stringify(message)
				}
				utils.sendUnexpectedError(res, 'Unexpected Error: ' + message);
				return
			}

			// Organization info for the current access token has been processed and cached
			profile.orgState = orgsEnum.PROCESSED;

			req.user.partyId = profile.partyId
			cache.set(req.user.accessToken, profile);

			console.log("#################")
			console.log(profile)
			next();
		}
	};

    const addIdp = function addIdp(idp, strategy) {
        idps[idp] = strategy;
    }

    const removeIdp = function removeIdp(idp) {
        delete idps[idp]
    }

    return {
        headerAuthentication: headerAuthentication,
        checkOrganizations: checkOrganizations,
        setPartyObj: setPartyObj,
        addIdp: addIdp,
        removeIdp: removeIdp
    }
}

exports.auth = auth;
exports.authMiddleware = authMiddleware;