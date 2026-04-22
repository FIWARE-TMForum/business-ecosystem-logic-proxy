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

const responseRewriter = require('../lib/responseRewriter').responseRewriter;

const getById = (() => {
    const CANNOT_RESOLVE_TARGETS_ERROR = {
        status: 422,
        message: 'Cannot resolve federation targets for this request'
    };

    const getPathSegments = function(req) {
        const apiUrl = req && typeof req.apiUrl === 'string' ? req.apiUrl : '';
        const path = apiUrl.split('?')[0];
        return path.split('/').filter((segment) => segment.length > 0);
    };

    const getSourceEndpointFromQuery = function(req) {
        if (!req || !req.query || typeof req.query.sourceEndpoint !== 'string') {
            return '';
        }

        return req.query.sourceEndpoint.trim();
    };

    const decodePathSegment = function(segment) {
        if (typeof segment !== 'string') {
            return '';
        }

        try {
            return decodeURIComponent(segment);
        } catch (_) {
            return segment;
        }
    };

    const preprocessRequest = async function(req) {
        if (req.method !== 'GET') {
            throw {
                status: 405,
                message: `The HTTP method ${req.method} is not allowed in the accessed API`
            };
        }

        const pathSegments = getPathSegments(req);
        if (pathSegments.length !== 3) {
            throw CANNOT_RESOLVE_TARGETS_ERROR;
        }

        const api = pathSegments[0];
        const entity = pathSegments[1];
        const rawId = decodePathSegment(pathSegments[2]);
        if (!api || !entity || !rawId) {
            throw CANNOT_RESOLVE_TARGETS_ERROR;
        }

        const parsedReferenceId = responseRewriter.parseFederatedReferenceId(rawId);
        const sourceEndpointFromQuery = getSourceEndpointFromQuery(req);
        const sourceEndpoint = sourceEndpointFromQuery || (parsedReferenceId ? parsedReferenceId.sourceEndpoint : '');
        const id = parsedReferenceId ? parsedReferenceId.id : rawId;

        if (!sourceEndpoint || !id) {
            throw CANNOT_RESOLVE_TARGETS_ERROR;
        }

        return {
            api: api,
            entity: entity,
            target: {
                id: id,
                sourceEndpoint: sourceEndpoint
            }
        };
    };

    return {
        preprocessRequest: preprocessRequest
    };
})();

exports.getById = getById;
