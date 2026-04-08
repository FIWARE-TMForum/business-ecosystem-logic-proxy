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

const federation = (() => {
    const TMFORUM_ENDPOINT_CHARACTERISTIC = 'tmforumendpoint';

    const normalizeCharacteristicName = function(name) {
        if (typeof name !== 'string') {
            return '';
        }

        return name.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    const isOrganizationRequest = function(req) {
        return !!req && !!req.user && !!req.user.userId;
    };

    const getOrganizationPartyFromRequest = async function(req) {
        if (!isOrganizationRequest(req)) {
            return null;
        }

        if (!req.user.partyId) {
            return null;
        }

        try {
            const organizationResponse = await partyClient.getOrganization(req.user.partyId);
            return organizationResponse && organizationResponse.body ? organizationResponse.body : null;
        } catch (err) {
            logger.warn(`Error resolving organization party ${req.user.partyId}: ${err.message}`);
            return null;
        }
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

    const resolveTmforumApiUrl = async function(req, apiUrl) {
        const tmforumEndpoint = await resolveTmforumEndpoint(req);
        if (!tmforumEndpoint) {
            return apiUrl;
        }

        const apiPath = typeof req.apiUrl === 'string' ? req.apiUrl : apiUrl;

        return buildApiUrl(tmforumEndpoint, apiPath);
    };

    const resolveTmforumEndpoint = async function(req) {
        const organizationParty = await getOrganizationPartyFromRequest(req);
        if (!organizationParty) {
            return '';
        }

        return getTmforumEndpoint(organizationParty);
    };

    return {
        resolveTmforumEndpoint: resolveTmforumEndpoint,
        resolveTmforumApiUrl: resolveTmforumApiUrl
    };
})();

exports.federation = federation;
