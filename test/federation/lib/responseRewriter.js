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

const responseRewriter = require('../../../federation/lib/responseRewriter').responseRewriter;

describe('Federation response rewriter', function() {
    const SOURCE_ENDPOINT = 'https://endpoint-a';
    const getReferenceToken = function(id) {
        return Buffer
            .from(JSON.stringify({
                sourceEndpoint: SOURCE_ENDPOINT,
                id: id
            }), 'utf8')
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');
    };

    it('should rewrite nested reference ids and preserve root id', function() {
        const payload = {
            id: 'offer-1',
            href: 'https://endpoint-a/tmf-api/productCatalogManagement/v4/productOffering/offer-1',
            productSpecification: {
                id: 'spec-1',
                href: '/tmf-api/productCatalogManagement/v4/productSpecification/spec-1'
            },
            category: [{
                id: 'cat-1',
                href: '/catalog/category/cat-1'
            }],
            attachment: {
                href: 'https://external.example.com/file.pdf'
            }
        };

        const rewritten = responseRewriter.rewriteResponsePayload(payload, SOURCE_ENDPOINT);

        expect(rewritten.id).toBe(
            `federationRef::${getReferenceToken('offer-1')}`
        );
        expect(rewritten.productSpecification.id).toBe(
            `federationRef::${getReferenceToken('spec-1')}`
        );
        expect(rewritten.category[0].id).toBe(
            `federationRef::${getReferenceToken('cat-1')}`
        );
        expect(rewritten.href).toBe(payload.href);
        expect(rewritten.productSpecification.href).toBe(payload.productSpecification.href);
        expect(rewritten.attachment.href).toBe('https://external.example.com/file.pdf');
    });

    it('should skip ids that are already federated', function() {
        const payload = {
            productSpecification: {
                id: `federationRef::${getReferenceToken('spec-1')}`
            }
        };

        const rewritten = responseRewriter.rewriteResponsePayload(payload, SOURCE_ENDPOINT);

        expect(rewritten.productSpecification.id).toBe(
            `federationRef::${getReferenceToken('spec-1')}`
        );
    });

    it('should keep payload unchanged when source endpoint is missing', function() {
        const payload = {
            productSpecification: {
                id: 'spec-1'
            }
        };

        const rewritten = responseRewriter.rewriteResponsePayload(payload, '');

        expect(rewritten).toEqual(payload);
    });

    it('should parse federated reference id', function() {
        const parsed = responseRewriter.parseFederatedReferenceId(
            `federationRef::${getReferenceToken('urn:ngsi-ld:product-specification:1')}`
        );

        expect(parsed).toEqual({
            id: 'urn:ngsi-ld:product-specification:1',
            sourceEndpoint: SOURCE_ENDPOINT
        });
    });
});
