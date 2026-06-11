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

const proxyquire = require('proxyquire');
const testUtils = require('../../utils');

describe('Federation ordering controller', function() {
    let config;
    let partyClient;
    let searchEngine;

    const getController = function() {
        return proxyquire('../../../federation/controllers/ordering', {
            '../../config': config,
            '../../lib/party': { partyClient: partyClient },
            '../lib/search': { searchEngine: searchEngine }
        }).ordering;
    };

    beforeEach(function() {
        config = testUtils.getDefaultConfig();
        config.searchUrl = 'http://search.example.com';

        partyClient = {
            getIndividual: jasmine.createSpy('getIndividual').and.returnValue(Promise.resolve({
                body: {
                    externalReference: [{
                        externalReferenceType: 'idm_id',
                        name: 'VAT-BUYER'
                    }]
                }
            })),
            getOrganization: jasmine.createSpy('getOrganization').and.returnValue(Promise.resolve({
                body: {
                    externalReference: [{
                        externalReferenceType: 'idm_id',
                        name: 'VAT-ORG'
                    }]
                }
            }))
        };

        searchEngine = {
            searchProductOrders: jasmine.createSpy('searchProductOrders').and.returnValue(Promise.resolve([]))
        };
    });

    it('should reject non-GET requests', function(done) {
        const controller = getController();

        controller.preprocessRequest({
            method: 'POST',
            apiUrl: '/ordering/productOrder',
            query: {},
            user: {
                partyId: 'urn:party:buyer'
            }
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

    it('should reject productOrder GET by id', function(done) {
        const controller = getController();

        controller.preprocessRequest({
            method: 'GET',
            apiUrl: '/ordering/productOrder/order-1',
            query: {},
            user: {
                partyId: 'urn:party:buyer'
            }
        }).then(function() {
            fail('Expected promise to be rejected');
            done();
        }).catch(function(err) {
            expect(err).toEqual({
                status: 422,
                message: 'Cannot resolve federation targets for this request'
            });
            expect(searchEngine.searchProductOrders).not.toHaveBeenCalled();
            done();
        });
    });

    it('should reject unauthenticated product order searches', function(done) {
        const controller = getController();

        controller.preprocessRequest({
            method: 'GET',
            apiUrl: '/ordering/productOrder',
            query: {
                'relatedParty.id': 'urn:party:buyer'
            }
        }).then(function() {
            fail('Expected promise to be rejected');
            done();
        }).catch(function(err) {
            expect(err).toEqual({
                status: 401,
                message: 'You need to be authenticated to perform this request'
            });
            expect(searchEngine.searchProductOrders).not.toHaveBeenCalled();
            done();
        });
    });

    it('should reject product order searches for another party', function(done) {
        const controller = getController();

        controller.preprocessRequest({
            method: 'GET',
            apiUrl: '/ordering/productOrder',
            query: {
                'relatedParty.id': 'urn:party:other'
            },
            user: {
                partyId: 'urn:party:buyer'
            }
        }).then(function() {
            fail('Expected promise to be rejected');
            done();
        }).catch(function(err) {
            expect(err).toEqual({
                status: 403,
                message: 'You are not authorized to retrieve the entities made by the user urn:party:other'
            });
            expect(searchEngine.searchProductOrders).not.toHaveBeenCalled();
            done();
        });
    });

    it('should reject unsupported related party roles', function(done) {
        const controller = getController();

        controller.preprocessRequest({
            method: 'GET',
            apiUrl: '/ordering/productOrder',
            query: {
                'relatedParty.id': 'urn:party:buyer',
                'relatedParty.role': 'Admin'
            },
            user: {
                partyId: 'urn:party:buyer'
            }
        }).then(function() {
            fail('Expected promise to be rejected');
            done();
        }).catch(function(err) {
            expect(err).toEqual({
                status: 403,
                message: 'You are not allowed to filter parties using the specified role'
            });
            expect(searchEngine.searchProductOrders).not.toHaveBeenCalled();
            done();
        });
    });

    it('should search product orders using customer role by default', async function() {
        searchEngine.searchProductOrders.and.returnValue(Promise.resolve([
            { id: 'order-1', sourceEndpoint: 'https://endpoint-a' },
            { id: '', sourceEndpoint: 'https://endpoint-b' },
            { id: 'order-2', sourceEndpoint: '' }
        ]));
        const controller = getController();

        const result = await controller.preprocessRequest({
            method: 'GET',
            apiUrl: '/ordering/productOrder',
            query: {
                'relatedParty.id': 'urn:party:buyer',
                offset: '20',
                limit: '10'
            },
            user: {
                partyId: 'urn:party:buyer'
            }
        });

        expect(searchEngine.searchProductOrders).toHaveBeenCalledWith(
            'VAT-BUYER',
            config.roles.customer,
            { offset: '20', pageSize: '10' }
        );
        expect(partyClient.getIndividual).toHaveBeenCalledWith('urn:party:buyer');
        expect(result).toEqual({
            api: 'ordering',
            entity: 'productOrder',
            targets: [{ id: 'order-1', sourceEndpoint: 'https://endpoint-a' }]
        });
    });

    it('should use authenticated user party when related party id is omitted', async function() {
        const controller = getController();

        await controller.preprocessRequest({
            method: 'GET',
            apiUrl: '/ordering/productOrder',
            query: {},
            user: {
                partyId: 'urn:party:buyer'
            }
        });

        expect(searchEngine.searchProductOrders).toHaveBeenCalledWith(
            'VAT-BUYER',
            config.roles.customer,
            {}
        );
    });

    it('should canonicalize seller role for product order searches', async function() {
        const controller = getController();

        await controller.preprocessRequest({
            method: 'GET',
            apiUrl: '/ordering/productOrder',
            query: {
                'relatedParty.id': 'urn:party:seller',
                'relatedParty.role': 'seller'
            },
            user: {
                partyId: 'urn:party:seller'
            }
        });

        expect(searchEngine.searchProductOrders).toHaveBeenCalledWith(
            'VAT-BUYER',
            config.roles.seller,
            {}
        );
    });

    it('should resolve organization external reference when using organization context', async function() {
        const controller = getController();

        await controller.preprocessRequest({
            method: 'GET',
            apiUrl: '/ordering/productOrder',
            query: {
                'relatedParty.id': 'urn:party:org',
                'relatedParty.role': 'Seller'
            },
            user: {
                partyId: 'urn:party:org',
                userPartyId: 'urn:party:individual'
            }
        });

        expect(partyClient.getOrganization).toHaveBeenCalledWith('urn:party:org');
        expect(searchEngine.searchProductOrders).toHaveBeenCalledWith(
            'VAT-ORG',
            config.roles.seller,
            {}
        );
    });

    it('should reject when local party has no idm_id external reference', function(done) {
        partyClient.getIndividual.and.returnValue(Promise.resolve({
            body: {
                externalReference: []
            }
        }));
        const controller = getController();

        controller.preprocessRequest({
            method: 'GET',
            apiUrl: '/ordering/productOrder',
            query: {
                'relatedParty.id': 'urn:party:buyer'
            },
            user: {
                partyId: 'urn:party:buyer'
            }
        }).then(function() {
            fail('Expected promise to be rejected');
            done();
        }).catch(function(err) {
            expect(err).toEqual({
                status: 422,
                message: 'Cannot resolve federation targets for this request'
            });
            expect(searchEngine.searchProductOrders).not.toHaveBeenCalled();
            done();
        });
    });

    it('should return search error when search backend fails', function(done) {
        searchEngine.searchProductOrders.and.returnValue(Promise.reject(new Error('boom')));
        const controller = getController();

        controller.preprocessRequest({
            method: 'GET',
            apiUrl: '/ordering/productOrder',
            query: {
                'relatedParty.id': 'urn:party:buyer'
            },
            user: {
                partyId: 'urn:party:buyer'
            }
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
