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

const partyClient = require('../../lib/party').partyClient;
const logger = require('../../lib/logger').logger.getLogger('Federation');
const responseRewriter = require('./responseRewriter').responseRewriter;
const LRU = require('lru-cache');

const federation = (() => {
    const TMFORUM_ENDPOINT_CHARACTERISTIC = 'tmforumendpoint';
    const IDM_EXTERNAL_REFERENCE_TYPE = 'idm_id';
    const RELATED_PARTY_QUERY_KEYS = ['relatedParty.id', 'relatedParty.href', 'relatedParty'];
    const ENDPOINT_CACHE_SEPARATOR = '||';
    const remotePartyCache = new LRU({
        max: 500,
        maxAge: 1000 * 60 * 120 // 2 hours
    });
    const remotePartyByEndpointCache = new LRU({
        max: 500,
        maxAge: 1000 * 60 * 120 // 2 hours
    });

    const normalizeCharacteristicName = function(name) {
        if (typeof name !== 'string') {
            return '';
        }

        return name.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    const isOrganizationRequest = function(req) {
        return !!req && !!req.user && !!req.user.userId;
    };

    const isOrganizationPartyId = function(partyId) {
        return typeof partyId === 'string' && partyId.toLowerCase().includes('organization');
    };

    const getOrganizationPartyById = async function(partyId) {
        if (!isOrganizationPartyId(partyId)) {
            return null;
        }

        try {
            const organizationResponse = await partyClient.getOrganization(partyId);
            return organizationResponse && organizationResponse.body ? organizationResponse.body : null;
        } catch (err) {
            logger.warn(`Error resolving organization party ${partyId}: ${err.message}`);
            return null;
        }
    };

    const getOrganizationPartyFromRequest = async function(req) {
        if (!isOrganizationRequest(req)) {
            return null;
        }

        if (!req.user.partyId) {
            return null;
        }

        return getOrganizationPartyById(req.user.partyId);
    };

    const getTmforumEndpoint = function(organizationParty) {
        if (!organizationParty || !Array.isArray(organizationParty.partyCharacteristic)) {
            return '';
        }

        const endpointCharacteristic = organizationParty.partyCharacteristic.find((characteristic) => {
            return (
                characteristic &&
                normalizeCharacteristicName(characteristic.name) === TMFORUM_ENDPOINT_CHARACTERISTIC
            );
        });

        if (!endpointCharacteristic || endpointCharacteristic.value == null) {
            return '';
        }

        return String(endpointCharacteristic.value).trim();
    };

    const getIdmExternalReferenceName = function(organizationParty) {
        if (!organizationParty || !Array.isArray(organizationParty.externalReference)) {
            return '';
        }

        const idmExternalReference = organizationParty.externalReference.find((extRef) => {
            return (
                extRef &&
                typeof extRef.externalReferenceType === 'string' &&
                extRef.externalReferenceType.toLowerCase() === IDM_EXTERNAL_REFERENCE_TYPE
            );
        });

        if (!idmExternalReference || idmExternalReference.name == null) {
            return '';
        }

        return String(idmExternalReference.name).trim();
    };

    const buildApiUrl = function(baseUrl, apiPath) {
        const normalizedBaseUrl = String(baseUrl).trim().replace(/\/+$/, '');
        let normalizedApiPath = String(apiPath || '').trim();

        if (normalizedApiPath.length === 0) {
            return normalizedBaseUrl;
        }

        if (/^https?:\/\//i.test(normalizedApiPath)) {
            try {
                const parsedApiPath = new URL(normalizedApiPath);
                normalizedApiPath = `${parsedApiPath.pathname || ''}${parsedApiPath.search || ''}${parsedApiPath.hash || ''}`;
            } catch (_) {
                normalizedApiPath = '';
            }
        }

        if (normalizedApiPath.length === 0) {
            return normalizedBaseUrl;
        }

        return normalizedBaseUrl + '/' + normalizedApiPath.replace(/^\/+/, '');
    };

    const isPartyApiRequest = function(req, apiUrl) {
        const sourceApiUrl = req && typeof req.apiUrl === 'string' ? req.apiUrl : apiUrl;
        if (typeof sourceApiUrl !== 'string') {
            return false;
        }

        let path = sourceApiUrl;
        if (/^https?:\/\//i.test(path)) {
            try {
                path = new URL(path).pathname || '';
            } catch (_) {
                path = '';
            }
        }

        return /^\/party(?:\/|$)/.test(path);
    };

    const getQueryLocalOrganizationPartyId = function(queryValue) {
        if (typeof queryValue !== 'string') {
            return '';
        }

        const trimmedValue = queryValue.trim();
        if (!trimmedValue) {
            return '';
        }

        if (isOrganizationPartyId(trimmedValue)) {
            return trimmedValue;
        }

        return '';
    };

    const getSessionRemotePartyIdForLocalPartyId = function(req, localPartyId) {
        if (
            !req ||
            !req.user ||
            typeof req.user.partyId !== 'string' ||
            req.user.partyId !== localPartyId ||
            typeof req.user.remotePartyId !== 'string' ||
            req.user.remotePartyId.length === 0
        ) {
            return '';
        }

        return req.user.remotePartyId;
    };

    const getCachedRemotePartyIdByLocalPartyId = function(localPartyId) {
        if (typeof localPartyId !== 'string' || localPartyId.length === 0) {
            return '';
        }

        return remotePartyCache.get(localPartyId) || '';
    };

    const setCachedRemotePartyIdByLocalPartyId = function(localPartyId, remotePartyId) {
        if (
            typeof localPartyId !== 'string' ||
            localPartyId.length === 0 ||
            typeof remotePartyId !== 'string' ||
            remotePartyId.length === 0
        ) {
            return;
        }

        remotePartyCache.set(localPartyId, remotePartyId);
    };

    const getRemotePartyEndpointCacheKey = function(tmforumEndpoint, localPartyId) {
        if (
            typeof tmforumEndpoint !== 'string' ||
            tmforumEndpoint.trim().length === 0 ||
            typeof localPartyId !== 'string' ||
            localPartyId.length === 0
        ) {
            return '';
        }

        return `${tmforumEndpoint.trim().replace(/\/+$/, '')}${ENDPOINT_CACHE_SEPARATOR}${localPartyId}`;
    };

    const getLocalPartyIdFromRemotePartyCacheKey = function(cacheKey) {
        if (typeof cacheKey !== 'string' || cacheKey.length === 0) {
            return '';
        }

        const separatorIndex = cacheKey.indexOf(ENDPOINT_CACHE_SEPARATOR);
        if (separatorIndex < 0) {
            return cacheKey;
        }

        return cacheKey.substring(separatorIndex + ENDPOINT_CACHE_SEPARATOR.length);
    };

    const getCachedRemotePartyIdByLocalPartyIdInEndpoint = function(tmforumEndpoint, localPartyId) {
        const cacheKey = getRemotePartyEndpointCacheKey(tmforumEndpoint, localPartyId);
        if (!cacheKey) {
            return '';
        }

        return remotePartyByEndpointCache.get(cacheKey) || '';
    };

    const setCachedRemotePartyIdByLocalPartyIdInEndpoint = function(tmforumEndpoint, localPartyId, remotePartyId) {
        const cacheKey = getRemotePartyEndpointCacheKey(tmforumEndpoint, localPartyId);
        if (
            !cacheKey ||
            typeof remotePartyId !== 'string' ||
            remotePartyId.length === 0
        ) {
            return;
        }

        remotePartyByEndpointCache.set(cacheKey, remotePartyId);
    };

    const getCachedLocalPartyIdByRemotePartyId = function(remotePartyId) {
        if (typeof remotePartyId !== 'string' || remotePartyId.length === 0) {
            return '';
        }

        let localPartyId = '';
        remotePartyCache.forEach((cachedRemotePartyId, cachedLocalPartyId) => {
            if (!localPartyId && cachedRemotePartyId === remotePartyId) {
                localPartyId = cachedLocalPartyId;
            }
        });
        remotePartyByEndpointCache.forEach((cachedRemotePartyId, cacheKey) => {
            if (!localPartyId && cachedRemotePartyId === remotePartyId) {
                localPartyId = getLocalPartyIdFromRemotePartyCacheKey(cacheKey);
            }
        });

        return localPartyId;
    };

    const resolveFederatedOrganizationParty = async function(tmforumEndpoint, localPartyId, externalReferenceName) {
        if (typeof tmforumEndpoint !== 'string' || tmforumEndpoint.trim().length === 0) {
            throw {
                status: 422,
                message: 'Missing federation endpoint context'
            };
        }

        if (typeof externalReferenceName !== 'string' || externalReferenceName.trim().length === 0) {
            throw {
                status: 422,
                message: 'Missing external reference for federated organization lookup'
            };
        }

        const cachedRemotePartyId = getCachedRemotePartyIdByLocalPartyIdInEndpoint(tmforumEndpoint, localPartyId);
        if (cachedRemotePartyId) {
            return {
                id: cachedRemotePartyId,
                href: cachedRemotePartyId
            };
        }

        const query = `externalReference.name=${encodeURIComponent(externalReferenceName.trim())}`;
        const organizationsResponse = await partyClient.getOrganizationsByQueryInApi(tmforumEndpoint, query);
        const organizations = organizationsResponse && Array.isArray(organizationsResponse.body)
            ? organizationsResponse.body
            : [];

        if (organizations.length !== 1) {
            throw {
                status: 422,
                message: `Cannot resolve unique federated organization for externalReference.name=${externalReferenceName}. matches=${organizations.length}`
            };
        }

        const organization = organizations[0];
        if (organization && organization.id) {
            setCachedRemotePartyIdByLocalPartyIdInEndpoint(tmforumEndpoint, localPartyId, organization.id);
        }

        return organization;
    };

    const resolveRemotePartyIdByLocalPartyId = async function(localPartyId) {
        const cachedRemotePartyId = getCachedRemotePartyIdByLocalPartyId(localPartyId);
        if (cachedRemotePartyId) {
            return cachedRemotePartyId;
        }

        const localOrganization = await getOrganizationPartyById(localPartyId);
        if (!localOrganization) {
            throw {
                status: 422,
                message: `Cannot resolve local organization party ${localPartyId}`
            };
        }

        const tmforumEndpoint = getTmforumEndpoint(localOrganization);
        if (!tmforumEndpoint) {
            throw {
                status: 422,
                message: `Missing TMForum endpoint for local organization party ${localPartyId}`
            };
        }

        const externalReferenceName = getIdmExternalReferenceName(localOrganization);
        if (!externalReferenceName) {
            throw {
                status: 422,
                message: `Missing idm_id external reference for local organization party ${localPartyId}`
            };
        }

        const remoteOrganization = await resolveFederatedOrganizationParty(
            tmforumEndpoint,
            localPartyId,
            externalReferenceName
        );

        if (!remoteOrganization || !remoteOrganization.id) {
            throw {
                status: 422,
                message: `Cannot resolve remote organization party for local organization ${localPartyId}`
            };
        }

        setCachedRemotePartyIdByLocalPartyId(localPartyId, remoteOrganization.id);
        return remoteOrganization.id;
    };

    const resolveRemotePartyIdByLocalPartyIdInEndpoint = async function(localPartyId, tmforumEndpoint) {
        const cachedRemotePartyId = getCachedRemotePartyIdByLocalPartyIdInEndpoint(tmforumEndpoint, localPartyId);
        if (cachedRemotePartyId) {
            return cachedRemotePartyId;
        }

        const localOrganization = await getOrganizationPartyById(localPartyId);
        if (!localOrganization) {
            throw {
                status: 422,
                message: `Cannot resolve local organization party ${localPartyId}`
            };
        }

        const externalReferenceName = getIdmExternalReferenceName(localOrganization);
        if (!externalReferenceName) {
            throw {
                status: 422,
                message: `Missing idm_id external reference for local organization party ${localPartyId}`
            };
        }

        const remoteOrganization = await resolveFederatedOrganizationParty(
            tmforumEndpoint,
            localPartyId,
            externalReferenceName
        );

        if (!remoteOrganization || !remoteOrganization.id) {
            throw {
                status: 422,
                message: `Cannot resolve remote organization party for local organization ${localPartyId}`
            };
        }

        return remoteOrganization.id;
    };

    const rewriteRelatedPartyQueryValues = async function(req, apiPath, tmforumEndpoint) {
        if (typeof apiPath !== 'string' || apiPath.indexOf('?') < 0) {
            return apiPath;
        }

        let parsedApiPath;
        try {
            parsedApiPath = new URL(apiPath, 'http://localhost');
        } catch (_) {
            return apiPath;
        }

        const remoteIdByLocalId = {};
        let rewritten = false;

        for (const queryKey of RELATED_PARTY_QUERY_KEYS) {
            const values = parsedApiPath.searchParams.getAll(queryKey);
            if (!values || values.length === 0) {
                continue;
            }

            const rewrittenValues = [];
            for (const value of values) {
                const localPartyId = getQueryLocalOrganizationPartyId(value);
                if (!localPartyId) {
                    rewrittenValues.push(value);
                    continue;
                }

                if (!remoteIdByLocalId[localPartyId]) {
                    if (typeof tmforumEndpoint === 'string' && tmforumEndpoint.trim().length > 0) {
                        remoteIdByLocalId[localPartyId] = await resolveRemotePartyIdByLocalPartyIdInEndpoint(
                            localPartyId,
                            tmforumEndpoint
                        );
                    } else {
                        const sessionRemotePartyId = getSessionRemotePartyIdForLocalPartyId(req, localPartyId);
                        if (sessionRemotePartyId) {
                            remoteIdByLocalId[localPartyId] = sessionRemotePartyId;
                            setCachedRemotePartyIdByLocalPartyId(localPartyId, sessionRemotePartyId);
                        } else {
                            remoteIdByLocalId[localPartyId] = await resolveRemotePartyIdByLocalPartyId(localPartyId);
                        }
                    }
                }

                rewrittenValues.push(remoteIdByLocalId[localPartyId]);
                rewritten = true;
            }

            parsedApiPath.searchParams.delete(queryKey);
            rewrittenValues.forEach((value) => {
                parsedApiPath.searchParams.append(queryKey, value);
            });
        }

        if (!rewritten) {
            return apiPath;
        }

        return `${parsedApiPath.pathname || ''}${parsedApiPath.search || ''}${parsedApiPath.hash || ''}`;
    };

    const setRequestFederationContext = function(req, tmforumEndpoint) {
        if (!req || typeof tmforumEndpoint !== 'string' || tmforumEndpoint.trim().length === 0) {
            return;
        }

        req.federationContext = {
            tmforumEndpoint: tmforumEndpoint
        };
    };

    const resolveRequestFederationInfo = async function(req, apiUrl) {
        const federatedPathReference = getFederatedPathReference(apiUrl);
        if (federatedPathReference) {
            return {
                apiPath: stripTargetQueryParam(federatedPathReference.apiPath),
                tmforumEndpoint: federatedPathReference.sourceEndpoint
            };
        }

        // Party API remains local because these entities define federation configuration.
        if (isPartyApiRequest(req, apiUrl)) {
            return {
                localApiUrl: ''
            };
        }

        const targetReference = getTargetFederatedReference(apiUrl);
        if (targetReference) {
            return {
                apiPath: targetReference.apiPath,
                tmforumEndpoint: targetReference.sourceEndpoint
            };
        }

        const tmforumEndpoint = await resolveTmforumEndpoint(req);
        if (!tmforumEndpoint) {
            return {
                localApiUrl: apiUrl
            };
        }

        return {
            apiPath: apiUrl,
            tmforumEndpoint: tmforumEndpoint
        };
    };

    const resolveTmforumApiUrl = async function(req, apiUrl) {
        const federationInfo = await resolveRequestFederationInfo(req, apiUrl);
        if (!federationInfo.tmforumEndpoint) {
            return federationInfo.localApiUrl;
        }

        setRequestFederationContext(req, federationInfo.tmforumEndpoint);
        const rewrittenApiPath = await rewriteRelatedPartyQueryValues(
            req,
            federationInfo.apiPath,
            federationInfo.tmforumEndpoint
        );
        return buildApiUrl(federationInfo.tmforumEndpoint, rewrittenApiPath);
    };

    const setRequestFederationContextFromApiUrl = async function(req, apiUrl) {
        const federationInfo = await resolveRequestFederationInfo(req, apiUrl);
        if (!federationInfo.tmforumEndpoint) {
            return null;
        }

        setRequestFederationContext(req, federationInfo.tmforumEndpoint);
        return req && req.federationContext ? req.federationContext : null;
    };

    const resolveTmforumApiUrlByPartyId = async function(apiUrl, partyId) {
        const tmforumEndpoint = await resolveTmforumEndpointByPartyId(partyId);
        if (!tmforumEndpoint) {
            return apiUrl;
        }

        return buildApiUrl(tmforumEndpoint, apiUrl);
    };

    const resolveTmforumEndpoint = async function(req) {
        const organizationParty = await getOrganizationPartyFromRequest(req);
        if (!organizationParty) {
            return '';
        }

        return getTmforumEndpoint(organizationParty);
    };

    const resolveTmforumEndpointByPartyId = async function(partyId) {
        const organizationParty = await getOrganizationPartyById(partyId);
        if (!organizationParty) {
            return '';
        }

        return getTmforumEndpoint(organizationParty);
    };

    const parseApiUrl = function(apiUrl) {
        if (typeof apiUrl !== 'string') {
            return null;
        }

        try {
            return new URL(apiUrl, 'http://localhost');
        } catch (_) {
            return null;
        }
    };

    const toApiPath = function(parsedApiUrl) {
        if (!parsedApiUrl) {
            return '';
        }

        return `${parsedApiUrl.pathname || ''}${parsedApiUrl.search || ''}${parsedApiUrl.hash || ''}`;
    };

    const getFederatedPathReference = function(apiUrl) {
        const parsedApiUrl = parseApiUrl(apiUrl);
        if (!parsedApiUrl) {
            return null;
        }

        const pathSegments = (parsedApiUrl.pathname || '').split('/');
        for (let i = 0; i < pathSegments.length; i++) {
            const pathSegment = decodeURIComponent(pathSegments[i]);
            const parsedReferenceId = responseRewriter.parseFederatedReferenceId(pathSegment);
            if (parsedReferenceId && parsedReferenceId.sourceEndpoint && parsedReferenceId.id) {
                pathSegments[i] = parsedReferenceId.id;
                parsedApiUrl.pathname = pathSegments.join('/');

                return {
                    id: parsedReferenceId.id,
                    sourceEndpoint: parsedReferenceId.sourceEndpoint,
                    apiPath: toApiPath(parsedApiUrl)
                };
            }
        }

        return null;
    };

    const getTargetFederatedReference = function(apiUrl) {
        const parsedApiUrl = parseApiUrl(apiUrl);
        if (!parsedApiUrl) {
            return null;
        }

        const targetValue = parsedApiUrl.searchParams.get('target');
        const parsedReferenceId = responseRewriter.parseFederatedReferenceId(targetValue);
        if (!parsedReferenceId || !parsedReferenceId.sourceEndpoint || !parsedReferenceId.id) {
            return null;
        }

        parsedApiUrl.searchParams.delete('target');

        return {
            id: parsedReferenceId.id,
            sourceEndpoint: parsedReferenceId.sourceEndpoint,
            apiPath: toApiPath(parsedApiUrl)
        };
    };

    const stripTargetQueryParam = function(apiUrl) {
        const parsedApiUrl = parseApiUrl(apiUrl);
        if (!parsedApiUrl) {
            return apiUrl;
        }

        parsedApiUrl.searchParams.delete('target');
        return toApiPath(parsedApiUrl);
    };

    const resolveLocalPartyIdByRemotePartyId = function(remotePartyId) {
        return getCachedLocalPartyIdByRemotePartyId(remotePartyId);
    };

    return {
        resolveTmforumEndpoint: resolveTmforumEndpoint,
        resolveTmforumApiUrl: resolveTmforumApiUrl,
        setRequestFederationContextFromApiUrl: setRequestFederationContextFromApiUrl,
        resolveTmforumEndpointByPartyId: resolveTmforumEndpointByPartyId,
        resolveTmforumApiUrlByPartyId: resolveTmforumApiUrlByPartyId,
        resolveFederatedOrganizationParty: resolveFederatedOrganizationParty,
        resolveRemotePartyIdByLocalPartyId: resolveRemotePartyIdByLocalPartyId,
        resolveLocalPartyIdByRemotePartyId: resolveLocalPartyIdByRemotePartyId
    };
})();

exports.federation = federation;
