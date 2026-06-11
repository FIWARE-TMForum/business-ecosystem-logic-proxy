/* Copyright (c) 2026 Future Internet Consulting and Development Solutions S.L.
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
const partyClient = require('../../lib/party').partyClient;
const searchEngine = require('../lib/search').searchEngine;

const ordering = (() => {
    const CANNOT_RESOLVE_TARGETS_ERROR = {
        status: 422,
        message: 'Cannot resolve federation targets for this request'
    };

    const getPathSegments = function(req) {
        const apiUrl = req && typeof req.apiUrl === 'string' ? req.apiUrl : '';
        const path = apiUrl.split('?')[0];
        return path.split('/').filter((segment) => segment.length > 0);
    };

    const buildSearchPage = function(req) {
        const page = {};

        if (req.query && req.query.offset != null) {
            page.offset = req.query.offset;
        }

        if (req.query && req.query.limit != null) {
            page.pageSize = req.query.limit;
        }

        return page;
    };

    const normalizeSearchTargets = function(results) {
        if (!Array.isArray(results)) {
            return [];
        }

        return results.map((result) => {
            return {
                id: result && result.id != null ? String(result.id) : '',
                sourceEndpoint: result && result.sourceEndpoint != null ? String(result.sourceEndpoint) : ''
            };
        }).filter((result) => {
            return result.id.length > 0 && result.sourceEndpoint.length > 0;
        });
    };

    const normalizeRole = function(rawRole) {
        const role = rawRole != null && String(rawRole).trim().length > 0
            ? String(rawRole).trim()
            : config.roles.customer;

        if (role.toLowerCase() === config.roles.customer.toLowerCase()) {
            return config.roles.customer;
        }

        if (role.toLowerCase() === config.roles.seller.toLowerCase()) {
            return config.roles.seller;
        }

        throw {
            status: 403,
            message: 'You are not allowed to filter parties using the specified role'
        };
    };

    const resolvePartyId = function(req) {
        if (!req.user || !req.user.partyId) {
            throw {
                status: 401,
                message: 'You need to be authenticated to perform this request'
            };
        }

        const queriedPartyId = req.query && req.query['relatedParty.id'] != null
            ? String(req.query['relatedParty.id'])
            : req.user.partyId;

        if (queriedPartyId !== req.user.partyId) {
            throw {
                status: 403,
                message: 'You are not authorized to retrieve the entities made by the user ' + queriedPartyId
            };
        }

        return queriedPartyId;
    };

    const getIdmExternalReferenceName = function(party) {
        if (!party || !Array.isArray(party.externalReference)) {
            return '';
        }

        const extRef = party.externalReference.find((ref) => {
            return (
                ref &&
                typeof ref.externalReferenceType === 'string' &&
                ref.externalReferenceType.toLowerCase() === 'idm_id'
            );
        });

        return extRef && extRef.name ? extRef.name : '';
    };

    const getLocalParty = function(req, partyId) {
        if (req.user && req.user.userPartyId) {
            return partyClient.getOrganization(partyId);
        }

        return partyClient.getIndividual(partyId);
    };

    const resolvePartyExternalReference = async function(req, partyId) {
        const partyResp = await getLocalParty(req, partyId);
        const partyExternalRef = getIdmExternalReferenceName(partyResp.body);

        if (!partyExternalRef) {
            throw {
                status: 422,
                message: `Missing idm_id external reference for party ${partyId}`
            };
        }

        return partyExternalRef;
    };

    const processProductOrderCollection = async function(req) {
        if (!config.searchUrl) {
            throw {
                status: 422,
                message: 'Cannot resolve federation targets: search service is not configured'
            };
        }

        const partyId = resolvePartyId(req);
        const partyExternalRef = await resolvePartyExternalReference(req, partyId);
        const role = normalizeRole(req.query && req.query['relatedParty.role']);
        const page = buildSearchPage(req);
        const results = await searchEngine.searchProductOrders(partyExternalRef, role, page) || [];
        return normalizeSearchTargets(results);
    };

    const preprocessRequest = async function(req) {
        if (req.method !== 'GET') {
            throw {
                status: 405,
                message: `The HTTP method ${req.method} is not allowed in the accessed API`
            };
        }

        const pathSegments = getPathSegments(req);
        if (pathSegments.length !== 2 || pathSegments[0] !== 'ordering' || pathSegments[1] !== 'productOrder') {
            throw CANNOT_RESOLVE_TARGETS_ERROR;
        }

        try {
            return {
                api: 'ordering',
                entity: 'productOrder',
                targets: await processProductOrderCollection(req)
            };
        } catch (err) {
            if (err && (err.status === 401 || err.status === 403)) {
                throw err;
            }

            throw CANNOT_RESOLVE_TARGETS_ERROR;
        }
    };

    return {
        preprocessRequest: preprocessRequest
    };
})();

exports.ordering = ordering;
