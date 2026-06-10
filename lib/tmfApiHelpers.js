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
const config = require('./../config');
const responseRewriter = require('../federation/lib/responseRewriter').responseRewriter;
const utils = require('./utils');

const normalizePath = function(path) {
    if (typeof path !== 'string' || path.length === 0) {
        return '';
    }

    return path.startsWith('/') ? path : `/${path}`;
};

const getStatusFromError = function(err, defaultStatus) {
    if (err && err.status) {
        return err.status;
    }

    if (err && err.response && err.response.status) {
        return err.response.status;
    }
    return defaultStatus;
};

const isTmforumEndpoint = function(endpoint) {
    if (!endpoint || typeof endpoint.path !== 'string') {
        return false;
    }

    return Object.keys(config.tmforum).some((apiName) => {
        return config.tmforum[apiName].path === endpoint.path;
    });
};

const buildEndpointUrl = function(endpoint, assetPath) {
    return utils.getAPIURL(
        endpoint.appSsl,
        endpoint.host,
        endpoint.port,
        `${endpoint.apiPath || ''}${normalizePath(assetPath)}`
    );
};

const normalizeSourceEndpoint = function(sourceEndpoint) {
    return String(sourceEndpoint || '').trim().replace(/\/+$/, '');
};

const normalizeApiPath = function(apiPath) {
    const normalizedApiPath = normalizePath(apiPath || '').replace(/\/+$/, '');
    return normalizedApiPath === '/' ? '' : normalizedApiPath;
};

const buildSourceEndpointUrl = function(endpoint, sourceEndpoint, assetPath) {
    const normalizedSourceEndpoint = normalizeSourceEndpoint(sourceEndpoint);
    const apiPath = normalizeApiPath(endpoint && endpoint.apiPath);

    let parsedSourceEndpoint;
    try {
        parsedSourceEndpoint = new URL(normalizedSourceEndpoint);
    } catch (_) {
        return '';
    }

    const endpointPath = normalizeApiPath(parsedSourceEndpoint.pathname);
    const hasApiPath = apiPath.length > 0 && endpointPath.endsWith(apiPath);
    const finalPath = hasApiPath ? endpointPath : `${endpointPath}${apiPath}`;

    return `${parsedSourceEndpoint.origin}${finalPath}${normalizePath(assetPath)}`;
};

const getRequestFederationTmforumEndpoint = function(req) {
    if (
        !req ||
        !req.federationContext ||
        typeof req.federationContext.tmforumEndpoint !== 'string'
    ) {
        return '';
    }

    return normalizeSourceEndpoint(req.federationContext.tmforumEndpoint);
};

const resolveTargetUrl = function(endpoint, assetPath, req) {
    const localUrl = buildEndpointUrl(endpoint, assetPath);

    if (!config.federationEnabled || !req || !isTmforumEndpoint(endpoint)) {
        return localUrl;
    }

    const contextEndpoint = getRequestFederationTmforumEndpoint(req);
    if (contextEndpoint) {
        return buildSourceEndpointUrl(endpoint, contextEndpoint, assetPath) || localUrl;
    }

    return localUrl;
};

const resolveTargetUrlById = function(endpoint, entity, id, req, options = {}) {
    const assetId = id != null ? String(id) : '';
    const assetPath = `/${entity}/${encodeURIComponent(assetId)}`;

    if (!config.federationEnabled) {
        return {
            url: buildEndpointUrl(endpoint, assetPath),
            id: assetId,
            sourceEndpoint: '',
            federated: false
        };
    }

    const parsedFederatedId = responseRewriter.parseFederatedReferenceId(assetId);
    const sourceEndpoint = parsedFederatedId
        ? parsedFederatedId.sourceEndpoint
        : normalizeSourceEndpoint(options.sourceEndpoint) || getRequestFederationTmforumEndpoint(req);
    const resolvedId = parsedFederatedId ? parsedFederatedId.id : assetId;
    const resolvedAssetPath = `/${entity}/${encodeURIComponent(resolvedId)}`;

    if (!sourceEndpoint) {
        return {
            url: buildEndpointUrl(endpoint, resolvedAssetPath),
            id: resolvedId,
            sourceEndpoint: '',
            federated: false
        };
    }

    const sourceEndpointUrl = buildSourceEndpointUrl(endpoint, sourceEndpoint, resolvedAssetPath);
    return {
        url: sourceEndpointUrl || buildEndpointUrl(endpoint, resolvedAssetPath),
        id: resolvedId,
        sourceEndpoint: sourceEndpoint,
        federated: true
    };
};

const mapResponse = function(response) {
    return {
        status: response.status,
        body: response.data
    };
};

const mapResponseById = function(response, resolution) {
    return Object.assign(mapResponse(response), {
        id: resolution.id,
        sourceEndpoint: resolution.sourceEndpoint,
        federated: resolution.federated
    });
};

const getAsset = function(endpoint, assetPath, callback, req) {
    const uri = resolveTargetUrl(endpoint, assetPath, req);

    axios.get(uri).then((response) => {
        callback(null, mapResponse(response));
    }).catch((err) => {
        callback({
            status: getStatusFromError(err, 400),
            message: err && err.message ? err.message : undefined
        });
    });
};

const getAssetById = function(endpoint, entity, id, req, options = {}) {
    const resolution = resolveTargetUrlById(endpoint, entity, id, req, options);

    return axios.get(resolution.url).then((response) => {
        return mapResponseById(response, resolution);
    }).catch((err) => {
        throw {
            status: getStatusFromError(err, 400),
            message: err && err.message ? err.message : undefined
        };
    });
};

const createAsset = function(endpoint, assetPath, body, callback, req) {
    const uri = resolveTargetUrl(endpoint, assetPath, req);

    axios.post(uri, body).then((response) => {
        callback(null, mapResponse(response));
    }).catch((err) => {
        callback({
            status: getStatusFromError(err, 400),
            message: err && err.message ? err.message : undefined
        });
    });
};

const updateAsset = function(endpoint, assetPath, body, callback, req) {
    const uri = resolveTargetUrl(endpoint, assetPath, req);

    axios.patch(uri, body).then((response) => {
        callback(null, mapResponse(response));
    }).catch((err) => {
        callback({
            status: getStatusFromError(err, 400),
            message: err && err.message ? err.message : undefined
        });
    });
};

exports.tmfApiHelpers = {
    getAsset: getAsset,
    getAssetById: getAssetById,
    createAsset: createAsset,
    updateAsset: updateAsset
};
