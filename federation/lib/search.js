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

const axios = require('axios');
const config = require('../../config');

const searchEngine = (() => {
    const OFFERS_SEARCH_ENDPOINT_PATH = '/api/SearchProduct';
    const CATALOGS_SEARCH_ENDPOINT_PATH = '/api/SearchCatalog';

    const normalizeCategories = function(categories) {
        if (Array.isArray(categories)) {
            return categories
                .map((category) => String(category || '').trim())
                .filter((category) => category.length > 0);
        }

        if (typeof categories === 'string' && categories.trim().length > 0) {
            return categories
                .split(',')
                .map((category) => category.trim())
                .filter((category) => category.length > 0);
        }

        return [];
    };

    const buildOfferingSearchBody = function(categories, options) {
        const body = {
            categories: normalizeCategories(categories)
        };

        if (options && typeof options.sourceEndpoint === 'string' && options.sourceEndpoint.length > 0) {
            body.sourceEndpoint = options.sourceEndpoint;
        }

        if (options && Array.isArray(options.sourceEndpoints) && options.sourceEndpoints.length > 0) {
            body.sourceEndpoints = options.sourceEndpoints.filter((endpoint) => {
                return typeof endpoint === 'string' && endpoint.length > 0;
            });
        }

        return body;
    };

    const normalizeEndpointPath = function(endpointPath) {
        const rawPath = String(endpointPath || OFFERS_SEARCH_ENDPOINT_PATH).trim();
        const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
        return path.replace(/\/+$/, '');
    };

    const buildSearchUrl = function(endpointPath, keyword, page) {
        const encodedKeyword = encodeURIComponent(String(keyword || ''));
        let url = `${config.searchUrl}${normalizeEndpointPath(endpointPath)}/${encodedKeyword}`;

        if (page && page.offset != null && page.pageSize != null) {
            const pageN = Math.floor(parseInt(page.offset, 10) / parseInt(page.pageSize, 10));
            url = `${url}?page=${pageN}&size=${page.pageSize}`;
        }

        return url;
    };

    const normalizeSearchResults = function(responseData) {
        const searchResults = Array.isArray(responseData) ? responseData : [];
        return searchResults
            .filter((result) => result && result.id != null)
            .map((result) => {
                return Object.assign({}, result, {
                    id: String(result.id)
                });
            });
    };

    const executeSearch = async function(endpointPath, keyword, body = {}, page = {}) {
        if (!config.searchUrl) {
            throw {
                status: 400,
                message: 'Search URL is not configured'
            };
        }

        const response = await axios.post(buildSearchUrl(endpointPath, keyword, page || {}), body || {});
        return normalizeSearchResults(response.data);
    };

    const searchOffers = async function(keyword, categories, page, options = {}) {
        const endpointPath = options.endpointPath || OFFERS_SEARCH_ENDPOINT_PATH;
        const body = buildOfferingSearchBody(categories, options);
        return executeSearch(endpointPath, keyword, body, page);
    };

    const searchCatalogs = async function(keyword, page, options = {}) {
        const endpointPath = options.endpointPath || CATALOGS_SEARCH_ENDPOINT_PATH;
        return executeSearch(endpointPath, keyword, {}, page);
    };

    return {
        searchOffers: searchOffers,
        searchCatalogs: searchCatalogs
    };
})();

exports.searchEngine = searchEngine;
