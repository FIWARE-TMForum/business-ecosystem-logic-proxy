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

const partyClient = require('./party').partyClient;
const logger = require('./logger').logger.getLogger('Federation');
const LRU = require('lru-cache');

const federation = (() => {
    const TMFORUM_ENDPOINT_CHARACTERISTIC = 'tmforumendpoint';
    const remotePartyCache = new LRU({
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

    const isProductOrderCreationRequest = function(req, apiUrl) {
        if (!req || req.method !== 'POST') {
            return false;
        }

        const sourceApiUrl = typeof req.apiUrl === 'string' ? req.apiUrl : apiUrl;
        if (typeof sourceApiUrl !== 'string') {
            return false;
        }

        const normalizedPath = sourceApiUrl.split('?')[0];
        return /\/ordering\/productOrder$/.test(normalizedPath);
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

    const getOrderSeller = function(body) {
        let parsedBody = body;
        if (typeof parsedBody === 'string') {
            try {
                parsedBody = JSON.parse(parsedBody);
            } catch (_) {
                return null;
            }
        }

        if (!parsedBody || !Array.isArray(parsedBody.relatedParty)) {
            return null;
        }

        const seller = parsedBody.relatedParty.find((partyRef) => {
            return (
                partyRef &&
                typeof partyRef.id === 'string' &&
                typeof partyRef.role === 'string' &&
                partyRef.role.toLowerCase() === 'seller'
            );
        });

        return seller || null;
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

        return localPartyId;
    };

    const resolveOrganizationByExternalReferenceName = async function(externalReferenceName) {
        if (typeof externalReferenceName !== 'string' || externalReferenceName.trim().length === 0) {
            return null;
        }

        try {
            const query = `externalReference.name=${encodeURIComponent(externalReferenceName.trim())}`;
            const organizationsResponse = await partyClient.getOrganizationsByQuery(query);
            const organizations = organizationsResponse && Array.isArray(organizationsResponse.body)
                ? organizationsResponse.body
                : [];

            if (organizations.length !== 1) {
                logger.warn(
                    `Cannot resolve unique organization for externalReference.name=${externalReferenceName}. matches=${organizations.length}`
                );
                return null;
            }

            return organizations[0];
        } catch (err) {
            logger.warn(`Error resolving organization by externalReference.name=${externalReferenceName}: ${err.message}`);
            return null;
        }
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

        const cachedRemotePartyId = getCachedRemotePartyIdByLocalPartyId(localPartyId);
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
            setCachedRemotePartyIdByLocalPartyId(localPartyId, organization.id);
        }

        return organization;
    };

    const resolveTmforumApiUrl = async function(req, apiUrl) {
        // Party API must always use the local endpoint to avoid federated overrides.
        if (isPartyApiRequest(req, apiUrl)) {
            return '';
        }

        if (isProductOrderCreationRequest(req, apiUrl)) {
            const seller = getOrderSeller(req.body);
            if (!seller || !seller.id) {
                throw {
                    status: 422,
                    message: 'Product order federation requires a seller relatedParty'
                };
            }

            let sellerEndpoint = '';
            const cachedLocalSellerId = getCachedLocalPartyIdByRemotePartyId(seller.id);
            if (cachedLocalSellerId) {
                sellerEndpoint = await resolveTmforumEndpointByPartyId(cachedLocalSellerId);
            }

            if (!sellerEndpoint) {
                sellerEndpoint = await resolveTmforumEndpointByPartyId(seller.id);
            }

            if (!sellerEndpoint) {
                const localSellerOrganization = await resolveOrganizationByExternalReferenceName(seller.name);
                if (localSellerOrganization) {
                    sellerEndpoint = getTmforumEndpoint(localSellerOrganization);
                    if (localSellerOrganization.id) {
                        setCachedRemotePartyIdByLocalPartyId(localSellerOrganization.id, seller.id);
                    }
                }
            }

            if (!sellerEndpoint) {
                throw {
                    status: 422,
                    message: `Cannot resolve TMForum endpoint for seller ${seller.id}`
                };
            }

            return buildApiUrl(sellerEndpoint, apiUrl);
        }

        const tmforumEndpoint = await resolveTmforumEndpoint(req);
        if (!tmforumEndpoint) {
            return apiUrl;
        }
        return buildApiUrl(tmforumEndpoint, apiUrl);
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

    return {
        resolveTmforumEndpoint: resolveTmforumEndpoint,
        resolveTmforumApiUrl: resolveTmforumApiUrl,
        resolveTmforumEndpointByPartyId: resolveTmforumEndpointByPartyId,
        resolveTmforumApiUrlByPartyId: resolveTmforumApiUrlByPartyId,
        resolveFederatedOrganizationParty: resolveFederatedOrganizationParty
    };
})();

exports.federation = federation;
