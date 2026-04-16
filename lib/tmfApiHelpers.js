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
const federation = require('../federation/lib/federation').federation;
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

const resolveTargetUrl = async function(endpoint, assetPath, req) {
    const localUrl = buildEndpointUrl(endpoint, assetPath);

    if (!config.federationEnabled || !req || !isTmforumEndpoint(endpoint)) {
        return localUrl;
    }

    const federationUrl = await federation.resolveTmforumApiUrl(req, localUrl);
    if (typeof federationUrl === 'string' && /^https?:\/\//i.test(federationUrl)) {
        return federationUrl;
    }

    return localUrl;
};

const mapResponse = function(response) {
    return {
        status: response.status,
        body: response.data
    };
};

const getAsset = function(endpoint, assetPath, callback, req) {
    resolveTargetUrl(endpoint, assetPath, req).then((uri) => {
        axios.get(uri).then((response) => {
            callback(null, mapResponse(response));
        }).catch((err) => {
            callback({
                status: getStatusFromError(err, 400),
                message: err && err.message ? err.message : undefined
            });
        });
    }).catch((err) => {
        callback({
            status: getStatusFromError(err, 400),
            message: err && err.message ? err.message : undefined
        });
    });
};

const createAsset = function(endpoint, assetPath, body, callback, req) {
    resolveTargetUrl(endpoint, assetPath, req).then((uri) => {
        axios.post(uri, body).then((response) => {
            callback(null, mapResponse(response));
        }).catch((err) => {
            callback({
                status: getStatusFromError(err, 400),
                message: err && err.message ? err.message : undefined
            });
        });
    }).catch((err) => {
        callback({
            status: getStatusFromError(err, 400),
            message: err && err.message ? err.message : undefined
        });
    });
};

const updateAsset = function(endpoint, assetPath, body, callback, req) {
    resolveTargetUrl(endpoint, assetPath, req).then((uri) => {
        axios.patch(uri, body).then((response) => {
            callback(null, mapResponse(response));
        }).catch((err) => {
            callback({
                status: getStatusFromError(err, 400),
                message: err && err.message ? err.message : undefined
            });
        });
    }).catch((err) => {
        callback({
            status: getStatusFromError(err, 400),
            message: err && err.message ? err.message : undefined
        });
    });
};

exports.tmfApiHelpers = {
    getAsset: getAsset,
    createAsset: createAsset,
    updateAsset: updateAsset
};
