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
const searchEngine = require('../lib/search').searchEngine;

const catalog = (() => {
    const CANNOT_RESOLVE_TARGETS_ERROR = {
        status: 422,
        message: 'Cannot resolve federation targets for this request'
    };

    const getPathSegments = function(req) {
        const apiUrl = req && typeof req.apiUrl === 'string' ? req.apiUrl : '';
        const path = apiUrl.split('?')[0];
        return path.split('/').filter((segment) => segment.length > 0);
    };

    const resolveEntityContext = function(req, handlersByEntity) {
        const pathSegments = getPathSegments(req);

        for (let i = pathSegments.length - 1; i >= 0; i -= 1) {
            const segment = pathSegments[i];
            if (handlersByEntity[segment]) {
                return {
                    entity: segment,
                    isCollection: i === pathSegments.length - 1
                };
            }
        }

        return {
            entity: '',
            isCollection: false
        };
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

    const processProductOfferingCollection = async function(req) {
        if (!config.searchUrl) {
            throw {
                status: 422,
                message: 'Cannot resolve federation targets: search service is not configured'
            };
        }

        const page = buildSearchPage(req);
        const rawKeyword = req.query && req.query.keyword != null ? String(req.query.keyword) : '';
        const keyword = rawKeyword.trim().length > 0 ? rawKeyword : ' ';
        const results = await searchEngine.searchOffers(keyword, req.query['category.id'], page) || [];
        return normalizeSearchTargets(results);
    };

    const processCatalogCollection = async function(req) {
        if (!config.searchUrl) {
            throw {
                status: 422,
                message: 'Cannot resolve federation targets: search service is not configured'
            };
        }

        const page = buildSearchPage(req);
        const rawKeyword = req.query && req.query.keyword != null ? String(req.query.keyword) : '';
        const keyword = rawKeyword.trim().length > 0 ? rawKeyword : ' ';
        const results = await searchEngine.searchCatalogs(keyword, page) || [];
        return normalizeSearchTargets(results);
    };

    const entityGetHandlers = {
        productOffering: processProductOfferingCollection,
        catalog: processCatalogCollection
    };

    const preprocessRequest = async function(req) {
        if (req.method !== 'GET') {
            throw {
                status: 405,
                message: `The HTTP method ${req.method} is not allowed in the accessed API`
            };
        }

        const entityContext = resolveEntityContext(req, entityGetHandlers);
        if (!entityContext.entity || !entityContext.isCollection) {
            throw CANNOT_RESOLVE_TARGETS_ERROR;
        }

        try {
            return {
                entity: entityContext.entity,
                targets: await entityGetHandlers[entityContext.entity](req)
            };
        } catch (_) {
            throw CANNOT_RESOLVE_TARGETS_ERROR;
        }
    };

    return {
        preprocessRequest: preprocessRequest
    };
})();

exports.catalog = catalog;
