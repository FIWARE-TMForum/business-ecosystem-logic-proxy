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

describe('Federation catalog controller', function() {
    let config;
    let searchEngine;

    const getController = function() {
        return proxyquire('../../../federation/controllers/catalog', {
            '../../config': config,
            '../lib/search': { searchEngine: searchEngine }
        }).catalog;
    };

    beforeEach(function() {
        config = testUtils.getDefaultConfig();
        config.searchUrl = 'http://search.example.com';

        searchEngine = {
            searchOffers: jasmine.createSpy('searchOffers').and.returnValue(Promise.resolve([])),
            searchCatalogs: jasmine.createSpy('searchCatalogs').and.returnValue(Promise.resolve([]))
        };
    });

    it('should reject non-GET requests', function(done) {
        const controller = getController();
        const req = {
            method: 'POST'
        };

        controller.preprocessRequest(req).then(function() {
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

    it('should reject productOffering GET by id when targets cannot be resolved', function(done) {
        const controller = getController();
        const req = {
            method: 'GET',
            apiUrl: '/catalog/productOffering/abc',
            query: {
                keyword: 'edge'
            }
        };

        controller.preprocessRequest(req).then(function() {
            fail('Expected promise to be rejected');
            done();
        }).catch(function(err) {
            expect(err).toEqual({
                status: 422,
                message: 'Cannot resolve federation targets for this request'
            });
            expect(searchEngine.searchOffers).not.toHaveBeenCalled();
            expect(searchEngine.searchCatalogs).not.toHaveBeenCalled();
            done();
        });
    });

    it('should reject entities without mapped handlers', function(done) {
        const controller = getController();
        const req = {
            method: 'GET',
            apiUrl: '/catalog/category',
            query: {
                keyword: 'edge'
            }
        };

        controller.preprocessRequest(req).then(function() {
            fail('Expected promise to be rejected');
            done();
        }).catch(function(err) {
            expect(err).toEqual({
                status: 422,
                message: 'Cannot resolve federation targets for this request'
            });
            expect(searchEngine.searchOffers).not.toHaveBeenCalled();
            expect(searchEngine.searchCatalogs).not.toHaveBeenCalled();
            done();
        });
    });

    it('should return id/sourceEndpoint targets for product offering collection search', async function() {
        searchEngine.searchOffers.and.returnValue(Promise.resolve([
            { id: '10', sourceEndpoint: 'https://endpoint-a' },
            { id: '11', sourceEndpoint: 'https://endpoint-b' },
            { id: '', sourceEndpoint: 'https://endpoint-c' },
            { id: '12', sourceEndpoint: '' }
        ]));
        const controller = getController();
        const req = {
            method: 'GET',
            apiUrl: '/catalog/catalog/5/productOffering?keyword=edge',
            query: {
                keyword: 'edge',
                'category.id': 'cat-a,cat-b',
                offset: '20',
                limit: '10'
            }
        };

        const result = await controller.preprocessRequest(req);
        expect(searchEngine.searchOffers).toHaveBeenCalledWith(
            'edge',
            'cat-a,cat-b',
            { offset: '20', pageSize: '10' }
        );
        expect(result).toEqual({
            entity: 'productOffering',
            targets: [
                { id: '10', sourceEndpoint: 'https://endpoint-a' },
                { id: '11', sourceEndpoint: 'https://endpoint-b' }
            ]
        });
    });

    it('should reject nested productOffering requests by id', function(done) {
        const controller = getController();
        const req = {
            method: 'GET',
            apiUrl: '/catalog/catalog/5/productOffering/10',
            query: {
                keyword: 'edge'
            }
        };

        controller.preprocessRequest(req).then(function() {
            fail('Expected promise to be rejected');
            done();
        }).catch(function(err) {
            expect(err).toEqual({
                status: 422,
                message: 'Cannot resolve federation targets for this request'
            });
            expect(searchEngine.searchOffers).not.toHaveBeenCalled();
            expect(searchEngine.searchCatalogs).not.toHaveBeenCalled();
            done();
        });
    });

    it('should return empty list when search has no matches', async function() {
        searchEngine.searchOffers.and.returnValue(Promise.resolve([]));
        const controller = getController();
        const req = {
            method: 'GET',
            apiUrl: '/catalog/productOffering',
            query: {
                keyword: 'none'
            }
        };

        const result = await controller.preprocessRequest(req);
        expect(result).toEqual({
            entity: 'productOffering',
            targets: []
        });
    });

    it('should return empty list when search results cannot be mapped to federation targets', async function() {
        searchEngine.searchOffers.and.returnValue(Promise.resolve([
            { id: 'a' },
            { sourceEndpoint: 'https://endpoint-a' }
        ]));
        const controller = getController();
        const req = {
            method: 'GET',
            apiUrl: '/catalog/productOffering',
            query: {
                keyword: 'none'
            }
        };

        const result = await controller.preprocessRequest(req);
        expect(result).toEqual({
            entity: 'productOffering',
            targets: []
        });
    });

    it('should search by category without keyword', async function() {
        searchEngine.searchOffers.and.returnValue(Promise.resolve([
            { id: '20', sourceEndpoint: 'https://endpoint-a' }
        ]));
        const controller = getController();
        const req = {
            method: 'GET',
            apiUrl: '/catalog/productOffering',
            query: {
                'category.id': 'cat-only'
            }
        };

        const result = await controller.preprocessRequest(req);
        expect(searchEngine.searchOffers).toHaveBeenCalledWith(
            ' ',
            'cat-only',
            {}
        );
        expect(result).toEqual({
            entity: 'productOffering',
            targets: [{ id: '20', sourceEndpoint: 'https://endpoint-a' }]
        });
    });

    it('should query all when neither keyword nor category filter is provided', async function() {
        const controller = getController();
        const req = {
            method: 'GET',
            apiUrl: '/catalog/productOffering',
            query: {}
        };

        const result = await controller.preprocessRequest(req);
        expect(searchEngine.searchOffers).toHaveBeenCalledWith(
            ' ',
            undefined,
            {}
        );
        expect(result).toEqual({
            entity: 'productOffering',
            targets: []
        });
    });

    it('should use default space keyword when keyword is empty', async function() {
        const controller = getController();
        const req = {
            method: 'GET',
            apiUrl: '/catalog/productOffering',
            query: {
                keyword: ''
            }
        };

        await controller.preprocessRequest(req);
        expect(searchEngine.searchOffers).toHaveBeenCalledWith(
            ' ',
            undefined,
            {}
        );
    });

    it('should search catalogs collection and return mapped targets', async function() {
        searchEngine.searchCatalogs.and.returnValue(Promise.resolve([
            { id: 'cat-1', sourceEndpoint: 'https://endpoint-a' },
            { id: 'cat-2', sourceEndpoint: 'https://endpoint-b' }
        ]));
        const controller = getController();
        const req = {
            method: 'GET',
            apiUrl: '/catalog/catalog',
            query: {
                keyword: 'energy',
                offset: '0',
                limit: '6'
            }
        };

        const result = await controller.preprocessRequest(req);
        expect(searchEngine.searchCatalogs).toHaveBeenCalledWith(
            'energy',
            { offset: '0', pageSize: '6' }
        );
        expect(result).toEqual({
            entity: 'catalog',
            targets: [
                { id: 'cat-1', sourceEndpoint: 'https://endpoint-a' },
                { id: 'cat-2', sourceEndpoint: 'https://endpoint-b' }
            ]
        });
    });

    it('should use default keyword for catalog collection query', async function() {
        const controller = getController();
        const req = {
            method: 'GET',
            apiUrl: '/catalog/catalog',
            query: {}
        };

        await controller.preprocessRequest(req);
        expect(searchEngine.searchCatalogs).toHaveBeenCalledWith(
            ' ',
            {}
        );
    });

    it('should return search error when search backend fails', function(done) {
        searchEngine.searchOffers.and.returnValue(Promise.reject(new Error('boom')));
        const controller = getController();
        const req = {
            method: 'GET',
            apiUrl: '/catalog/productOffering',
            query: {
                keyword: 'fail'
            }
        };

        controller.preprocessRequest(req).then(function() {
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

    it('should reject when search service is not configured', function(done) {
        config.searchUrl = '';
        const controller = getController();
        const req = {
            method: 'GET',
            apiUrl: '/catalog/productOffering',
            query: {
                keyword: 'test'
            }
        };

        controller.preprocessRequest(req).then(function() {
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
