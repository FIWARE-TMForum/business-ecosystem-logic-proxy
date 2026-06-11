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
const utils = require('../../lib/utils');
const responseRewriter = require('./responseRewriter').responseRewriter;

const proxy = (() => {
    const SUPPORTED_COLLECTION_ENTITIES = {
        catalog: new Set(['productOffering', 'catalog']),
        ordering: new Set(['productOrder'])
    };

    const normalizePath = function(path) {
        const value = String(path || '').trim();
        if (value.length === 0) {
            return '';
        }

        return `/${value.replace(/^\/+|\/+$/g, '')}`;
    };

    const getApiConfigByPath = function(apiPathSegment) {
        const tmfApiConfigs = Object.values(config.tmforum || {});
        const tmfApiConfig = tmfApiConfigs.find((apiConfig) => apiConfig && apiConfig.path === apiPathSegment);
        if (tmfApiConfig) {
            return tmfApiConfig;
        }

        const endpointApiConfigs = Object.values(config.endpoints || {});
        return endpointApiConfigs.find((apiConfig) => apiConfig && apiConfig.path === apiPathSegment) || null;
    };

    const resolveApiBaseUrl = function(sourceEndpoint, apiPathSegment) {
        const endpoint = String(sourceEndpoint || '').trim().replace(/\/+$/, '');
        const apiConfig = getApiConfigByPath(apiPathSegment);
        const apiPath = normalizePath(apiConfig && apiConfig.apiPath);
        if (!apiConfig) {
            throw {
                status: 422,
                message: `Unsupported federation api ${apiPathSegment}`
            };
        }

        let baseUrl;
        try {
            baseUrl = new URL(endpoint);
        } catch (_) {
            throw {
                status: 422,
                message: `Invalid federation source endpoint ${sourceEndpoint}`
            };
        }

        const endpointPath = normalizePath(baseUrl.pathname);
        const hasApiPath = apiPath.length > 0 && endpointPath.endsWith(apiPath);
        const finalPath = hasApiPath ? endpointPath : `${endpointPath}${apiPath}`;

        return `${baseUrl.origin}${finalPath.replace(/\/{2,}/g, '/')}`;
    };

    const buildEntityCollectionUrl = function(sourceEndpoint, api, entity, ids) {
        const href = ids.map((id) => encodeURIComponent(id)).join(',');
        const collectionBaseUrl = `${resolveApiBaseUrl(sourceEndpoint, api).replace(/\/+$/, '')}/${entity}`;
        return `${collectionBaseUrl}?href=${href}`;
    };

    const buildEntityByIdUrl = function(sourceEndpoint, api, entity, id) {
        const entityBaseUrl = `${resolveApiBaseUrl(sourceEndpoint, api).replace(/\/+$/, '')}/${entity}`;
        return `${entityBaseUrl}/${encodeURIComponent(id)}`;
    };

    const groupTargetsBySourceEndpoint = function(searchTargets) {
        const groupedTargets = {};

        (searchTargets || []).forEach((target) => {
            const id = target && target.id != null ? String(target.id) : '';
            const sourceEndpoint = target && target.sourceEndpoint != null
                ? String(target.sourceEndpoint).trim().replace(/\/+$/, '')
                : '';

            if (id.length === 0 || sourceEndpoint.length === 0) {
                return;
            }

            if (!groupedTargets[sourceEndpoint]) {
                groupedTargets[sourceEndpoint] = [];
            }

            groupedTargets[sourceEndpoint].push(id);
        });

        return groupedTargets;
    };

    const normalizeOfferingsArray = function(data) {
        if (Array.isArray(data)) {
            return data;
        }

        if (data == null) {
            return [];
        }

        return [data];
    };

    const fetchEntitiesBySearchTargets = async function(req, searchTargets, api, entity) {
        if (!Array.isArray(searchTargets) || searchTargets.length === 0) {
            return [];
        }

        const headers = utils.proxiedRequestHeaders(req);
        if (req.user) {
            utils.attachUserHeaders(headers, req.user);
        }

        const groupedTargets = groupTargetsBySourceEndpoint(searchTargets);
        const groupedKeys = Object.keys(groupedTargets);

        const responses = await Promise.all(groupedKeys.map((sourceEndpoint) => {
            const ids = groupedTargets[sourceEndpoint];
            const url = buildEntityCollectionUrl(sourceEndpoint, api, entity, ids);

            return axios.request({
                url: url,
                method: 'GET',
                headers: headers
            }).then((response) => {
                const rawEntities = normalizeOfferingsArray(response.data);
                return {
                    sourceEndpoint: sourceEndpoint,
                    offerings: rawEntities.map((item) => {
                        return {
                            rawId: item && item.id != null ? String(item.id) : '',
                            entity: responseRewriter.rewriteResponsePayload(item, sourceEndpoint)
                        };
                    })
                };
            });
        }));

        const offeringsByKey = new Map();
        responses.forEach((response) => {
            response.offerings.forEach((offering) => {
                if (offering && offering.rawId) {
                    const key = `${response.sourceEndpoint}::${offering.rawId}`;
                    offeringsByKey.set(key, offering.entity);
                }
            });
        });

        return searchTargets.map((target) => {
            const sourceEndpoint = String(target.sourceEndpoint || '').trim().replace(/\/+$/, '');
            const key = `${sourceEndpoint}::${String(target.id)}`;
            return offeringsByKey.get(key);
        }).filter((offering) => !!offering);
    };

    const get = async function(req, res, searchTargets, entity, api = 'catalog') {
        if (!Array.isArray(searchTargets)) {
            throw {
                status: 422,
                message: 'Cannot resolve federation targets for this request'
            };
        }

        if (
            !SUPPORTED_COLLECTION_ENTITIES[api] ||
            !SUPPORTED_COLLECTION_ENTITIES[api].has(entity)
        ) {
            throw {
                status: 422,
                message: 'Cannot resolve federation targets for this request'
            };
        }

        const entities = await fetchEntitiesBySearchTargets(req, searchTargets, api, entity);
        return res.status(200).json(entities);
    };

    const getById = async function(req, res, resolution) {
        const api = resolution && resolution.api != null ? String(resolution.api).trim() : '';
        const entity = resolution && resolution.entity != null ? String(resolution.entity).trim() : '';
        const id = resolution && resolution.target && resolution.target.id != null
            ? String(resolution.target.id)
            : '';
        const sourceEndpoint = resolution && resolution.target && resolution.target.sourceEndpoint != null
            ? String(resolution.target.sourceEndpoint).trim()
            : '';

        if (!api || !entity || !id || !sourceEndpoint) {
            throw {
                status: 422,
                message: 'Cannot resolve federation targets for this request'
            };
        }

        const headers = utils.proxiedRequestHeaders(req);
        if (req.user) {
            utils.attachUserHeaders(headers, req.user);
        }

        const url = buildEntityByIdUrl(sourceEndpoint, api, entity, id);
        const response = await axios.request({
            url: url,
            method: 'GET',
            headers: headers
        });

        const rewrittenEntity = responseRewriter.rewriteResponsePayload(response.data, sourceEndpoint);
        return res.status(200).json(rewrittenEntity);
    };

    return {
        get: get,
        getById: getById
    };
})();

exports.proxy = proxy;
