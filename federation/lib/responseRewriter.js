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

const responseRewriter = (() => {
    const FEDERATED_REFERENCE_PREFIX = 'federationRef::';
    const REFERENCE_PARENT_KEYS = new Set([
        'attachment',
        'bundledProductOffering',
        'bundledProductSpecification',
        'catalog',
        'category',
        'offering',
        'place',
        'product',
        'productOffering',
        'productOfferingPrice',
        'productSpecification',
        'relatedParty',
        'resource',
        'resourceSpecification',
        'service',
        'serviceSpecification',
        'targetProductSchema'
    ]);

    const normalizeSourceEndpoint = function(sourceEndpoint) {
        if (typeof sourceEndpoint !== 'string') {
            return '';
        }

        return sourceEndpoint.trim().replace(/\/+$/, '');
    };

    const toBase64Url = function(value) {
        return Buffer
            .from(String(value || ''), 'utf8')
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');
    };

    const fromBase64Url = function(value) {
        if (typeof value !== 'string' || value.length === 0) {
            return '';
        }

        const base64Token = value
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        const paddedBase64Token = base64Token + '='.repeat((4 - base64Token.length % 4) % 4);

        try {
            return Buffer.from(paddedBase64Token, 'base64').toString('utf8');
        } catch (_) {
            return '';
        }
    };

    const buildFederatedReferenceToken = function(sourceEndpoint, id) {
        return toBase64Url(JSON.stringify({
            sourceEndpoint: sourceEndpoint,
            id: id
        }));
    };

    const parseTokenizedFederatedReferenceId = function(encodedValue) {
        const payloadText = fromBase64Url(encodedValue);
        if (!payloadText) {
            return null;
        }

        try {
            const payload = JSON.parse(payloadText);
            const sourceEndpoint = normalizeSourceEndpoint(payload && payload.sourceEndpoint);
            const id = payload && payload.id != null ? String(payload.id) : '';

            if (!sourceEndpoint || !id) {
                return null;
            }

            return {
                id: id,
                sourceEndpoint: sourceEndpoint
            };
        } catch (_) {
            return null;
        }
    };

    const isFederatedReferenceId = function(id) {
        return typeof id === 'string' && id.startsWith(FEDERATED_REFERENCE_PREFIX);
    };

    const rewriteReferenceId = function(id, sourceEndpoint) {
        if (typeof id !== 'string' || id.length === 0 || isFederatedReferenceId(id)) {
            return id;
        }

        const normalizedSourceEndpoint = normalizeSourceEndpoint(sourceEndpoint);
        if (!normalizedSourceEndpoint) {
            return id;
        }

        return `${FEDERATED_REFERENCE_PREFIX}${buildFederatedReferenceToken(normalizedSourceEndpoint, id)}`;
    };

    const buildFederatedReferenceId = function(sourceEndpoint, id) {
        if (!config.federationEnabled) {
            return id;
        }

        return rewriteReferenceId(id, sourceEndpoint);
    };

    const parseFederatedReferenceId = function(id) {
        if (!isFederatedReferenceId(id)) {
            return null;
        }

        const encodedValue = id.substring(FEDERATED_REFERENCE_PREFIX.length);
        if (!encodedValue) {
            return null;
        }

        return parseTokenizedFederatedReferenceId(encodedValue);
    };

    const isReferenceParentKey = function(parentKey) {
        if (typeof parentKey !== 'string' || parentKey.length === 0) {
            return false;
        }

        if (REFERENCE_PARENT_KEYS.has(parentKey)) {
            return true;
        }

        return parentKey.endsWith('Ref') || parentKey.endsWith('Refs');
    };

    const rewriteNode = function(node, sourceEndpoint, parentKey) {
        if (Array.isArray(node)) {
            return node.map((value) => rewriteNode(value, sourceEndpoint, parentKey));
        }

        if (!node || typeof node !== 'object') {
            return node;
        }

        const rewrittenNode = {};
        Object.keys(node).forEach((key) => {
            const value = node[key];
            if (
                key === 'id' &&
                typeof value === 'string' &&
                (parentKey.length === 0 || isReferenceParentKey(parentKey))
            ) {
                rewrittenNode[key] = rewriteReferenceId(value, sourceEndpoint);
                return;
            }

            rewrittenNode[key] = rewriteNode(value, sourceEndpoint, key);
        });

        return rewrittenNode;
    };

    const rewriteResponsePayload = function(payload, sourceEndpoint) {
        return rewriteNode(payload, sourceEndpoint, '');
    };

    return {
        rewriteResponsePayload: rewriteResponsePayload,
        buildFederatedReferenceId: buildFederatedReferenceId,
        parseFederatedReferenceId: parseFederatedReferenceId
    };
})();

exports.responseRewriter = responseRewriter;
