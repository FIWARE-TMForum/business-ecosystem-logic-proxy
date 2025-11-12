/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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

const axios = require('axios');
const config = require('../config.js');
const utils = require('./utils.js');
const logger = require('./logger').logger.getLogger('TMF')


const partyClient = (function() {
	const makePartyRequest = function(path, body, method, errMsg) {
		const headers = {
			'content-type': 'application/json',
			accept: 'application/json'
		};

		const url = utils.getAPIURL(
			config.endpoints.party.appSsl,
			config.endpoints.party.host,
			config.endpoints.party.port,
			`${config.endpoints.party.apiPath}${path}`
		);

		const options = {
			url: url,
			method: method,
			headers: headers
		};

		if (body) {
			options.data = body;
		}

		return new Promise((resolve, reject) => {
			axios.request(options).then((response) => {
				resolve({
					status: response.status,
					headers: response.headers,
					body: response.data
				});
			}).catch((err) => {
				let status = 504
				let message = 'Service unreachable'
				let body = null

				if (err.response != null) {
					status = err.response.status

					if ([400, 403, 409, 422].indexOf(status) >= 0) {
						const parsedResp = err.response.data;
						message = parsedResp['error'];
					}
					body = err.response.data
				}

				reject({
					status: status,
					message: message,
					body: body
				})
			})
		})
	};

	const getOrganizations = function() {
		return makePartyRequest(
			'/organization/',
			null,
			'GET',
			'The connection has failed while requesting all the organizations of the party API'
		);
	};

	const getOrganization = function(orgId) {
		return makePartyRequest(
			'/organization/' + orgId,
			null,
			'GET',
			'The connection has failed while requesting organization with id: ' + orgId,
		);
	};

	const createOrganization = function(body) {
		return makePartyRequest(
			'/organization',
			body,
			'POST',
			'The connection has failed while creating the organization'
		);
	};

	const updateOrganization = function(orgId, body) {
		return makePartyRequest(
			'/organization/' + orgId,
			body,
			'PATCH',
			'The connection has failed while updating the organization'
		);
	};

	const getIndividual = function(indID) {
		return makePartyRequest(
			'/individual/' + indID,
			null,
			'GET',
			'The connection has failed getting user info'
		);
	};

	const getOrganizationsByQuery = function(query) {
		return makePartyRequest(
			'/organization/?' + query,
			null,
			'GET',
			'The connection has failed getting organization info'
		)
	}

	const getIndividualsByQuery = function(query) {
		return makePartyRequest(
			'/individual/?' + query,
			null,
			'GET',
			'The connection has failed getting user info'
		)
	}

	const getIndividuals = function() {
		return makePartyRequest(
			'/individual/',
			null,
			'GET',
			'The connection has failed getting all users info'
		);
	};

	const updateIndividual = function(indID, body) {
		return makePartyRequest(
			'/individual/' + indID,
			body,
			'PATCH',
			'The connection has failed while updating the individual'
		);
	};

	const createIndividual = function(body) {
		return makePartyRequest(
			'/individual/',
			body,
			'POST',
			'The connection has failed while creating the individual'
		);
	};

	const getOperatorParty = async function() {
		const operatorId = config.operatorId;
		if (!operatorId || operatorId.length === 0) {
			return null
		}

		let did = operatorId;
		if (!operatorId.startsWith('did:')) {
			did = `did:elsi:${operatorId}`;
		}

		try {
			// Search by organization identification
			let orgs = await getOrganizationsByQuery(`organizationIdentification.identificationId=${did}`);
			if (orgs && orgs.body && orgs.body.length > 0) {
				// Found operator
				return orgs.body[0];
			}

			// Search by external reference
			orgs = await getOrganizationsByQuery(`externalReference.name=${did}`);
			if (orgs && orgs.body && orgs.body.length > 0) {
				// Found operator
				return orgs.body[0];
			}

			// Seach by external reference with did
			orgs = await getOrganizationsByQuery(`externalReference.name=${operatorId}`);
			if (orgs && orgs.body && orgs.body.length > 0) {
				// Found operator
				return orgs.body[0];
			}
		} catch (err) {
			logger.error(`Error getting operator party: ${err.message}`);
			return null;
		}

		return null;
	}


	return {
		getOrganization: getOrganization,
		getOrganizations: getOrganizations,
		getOrganizationsByQuery: getOrganizationsByQuery,
		createOrganization: createOrganization,
		updateOrganization: updateOrganization,
		getIndividual: getIndividual,
		getIndividualsByQuery: getIndividualsByQuery,
		getIndividuals: getIndividuals,
		updateIndividual: updateIndividual,
		createIndividual: createIndividual,
		getOperatorParty: getOperatorParty
	};
})();

exports.partyClient = partyClient;
