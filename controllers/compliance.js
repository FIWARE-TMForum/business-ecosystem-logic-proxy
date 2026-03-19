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

const logger = require('./../lib/logger').logger.getLogger('Compliance');
const complianceClient = require('./../lib/compliance').complianceClient;

const compliance = (function() {
    const serializeForLog = function(value) {
        try {
            return JSON.stringify(value);
        } catch (_) {
            return String(value);
        }
    };

    const parseBody = function(body) {
        if (body == null) {
            return null;
        }

        if (typeof body === 'string') {
            return JSON.parse(body);
        }

        if (typeof body === 'object') {
            return body;
        }

        return null;
    };

    const requestCertificate = async function(req, res) {
        const requestId = req && req.id ? req.id : 'n/a';
        logger.debug(`[${requestId}] Compliance endpoint called with bodyType=${typeof req.body}`);

        if (!req.user) {
            logger.warn(`[${requestId}] Compliance request rejected: missing credentials`);
            return res.status(401).json({ error: 'Missing credentials' });
        }
        logger.debug(
            `[${requestId}] Authenticated user context partyId=${req.user.partyId || 'unknown'} userId=${req.user.userId || req.user.id || 'unknown'}`
        );

        let productSpecification;
        try {
            productSpecification = parseBody(req.body);
            logger.debug(
                `[${requestId}] Parsed body keys=${serializeForLog(productSpecification ? Object.keys(productSpecification) : [])}`
            );
        } catch (_) {
            logger.warn(`[${requestId}] Compliance request rejected: invalid body`);
            return res.status(400).json({ error: 'Invalid body' });
        }

        if (!productSpecification) {
            logger.warn(`[${requestId}] Compliance request rejected: empty body`);
            return res.status(400).json({ error: 'Invalid body' });
        }

        logger.info(`[${requestId}] Processing compliance request for product specification: ${productSpecification.id || 'unknown'}`);
        logger.debug(
            `[${requestId}] Product specification summary name=${productSpecification.name || ''}, version=${productSpecification.version || ''}, relatedPartyCount=${Array.isArray(productSpecification.relatedParty) ? productSpecification.relatedParty.length : 0}, characteristicCount=${Array.isArray(productSpecification.productSpecCharacteristic) ? productSpecification.productSpecCharacteristic.length : 0}`
        );
        try {
            const response = await complianceClient.requestProductOfferingCertificate(
                productSpecification,
                req.user.accessToken
            );

            logger.info(`[${requestId}] Compliance request completed with status ${response.status}`);
            logger.debug(
                `[${requestId}] Compliance response headers keys=${serializeForLog(response && response.headers ? Object.keys(response.headers) : [])}`
            );
            return res.status(response.status).json(response.body);
        } catch (err) {
            logger.error(`[${requestId}] Error requesting product offering compliance certificate: ${err.message}`);
            logger.debug(
                `[${requestId}] Compliance error payload=${serializeForLog(err && err.body ? err.body : {})}`
            );
            const status = err && err.status ? err.status : 500;

            if (err && err.body) {
                return res.status(status).json(err.body);
            }

            return res.status(status).json({
                error: err && err.message ? err.message : 'Unexpected error requesting compliance certificate'
            });
        }
    };

    return {
        requestCertificate: requestCertificate
    };
})();

exports.compliance = compliance;
