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

const controller = require('../../../federation/controllers/getById').getById;

describe('Federation getById controller', function() {
    it('should reject non-GET requests', function(done) {
        controller.preprocessRequest({
            method: 'POST',
            apiUrl: '/catalog/productSpecification/spec-1',
            query: {}
        }).then(function() {
            fail('Expected promise to be rejected');
            done();
        }).catch(function(err) {
            expect(err).toEqual({
                status: 405,
                message: 'The HTTP method POST is not allowed in the accessed API'
            });
            done();
        });
    });

    it('should resolve target from federated reference id', async function() {
        const sourceEndpoint = 'https://endpoint-a';
        const referenceToken = Buffer
            .from(JSON.stringify({
                sourceEndpoint: sourceEndpoint,
                id: 'urn:ngsi-ld:product-specification:1'
            }), 'utf8')
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');

        const result = await controller.preprocessRequest({
            method: 'GET',
            apiUrl: `/catalog/productSpecification/federationRef::${referenceToken}`,
            query: {}
        });

        expect(result).toEqual({
            api: 'catalog',
            entity: 'productSpecification',
            target: {
                id: 'urn:ngsi-ld:product-specification:1',
                sourceEndpoint: sourceEndpoint
            }
        });
    });

    it('should resolve target from source endpoint query param', async function() {
        const result = await controller.preprocessRequest({
            method: 'GET',
            apiUrl: '/catalog/productOfferingPrice/urn:ngsi-ld:product-offering-price:1',
            query: {
                sourceEndpoint: 'https://endpoint-b'
            }
        });

        expect(result).toEqual({
            api: 'catalog',
            entity: 'productOfferingPrice',
            target: {
                id: 'urn:ngsi-ld:product-offering-price:1',
                sourceEndpoint: 'https://endpoint-b'
            }
        });
    });

    it('should reject when source endpoint cannot be resolved', function(done) {
        controller.preprocessRequest({
            method: 'GET',
            apiUrl: '/catalog/productSpecification/spec-1',
            query: {}
        }).then(function() {
            fail('Expected promise to be rejected');
            done();
        }).catch(function(err) {
            expect(err).toEqual({
                status: 422,
                message: 'Cannot resolve federation targets for this request'
            });
            done();
        });
    });
});
