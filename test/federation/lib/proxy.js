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

const nock = require('nock');
const proxyquire = require('proxyquire');
const testUtils = require('../../utils');

describe('Federation proxy', function() {
    let config;
    let utils;

    const getProxy = function() {
        return proxyquire('../../../federation/lib/proxy', {
            '../../config': config,
            '../../lib/utils': utils
        }).proxy;
    };

    const getResponseMock = function() {
        const res = jasmine.createSpyObj('res', ['status', 'json', 'setHeader', 'send']);
        res.status.and.returnValue(res);
        return res;
    };

    const getFederatedRef = function(sourceEndpoint, id) {
        const token = Buffer
            .from(JSON.stringify({
                sourceEndpoint: sourceEndpoint,
                id: id
            }), 'utf8')
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');
        return `federationRef::${token}`;
    };

    beforeEach(function() {
        nock.cleanAll();
        config = testUtils.getDefaultConfig();
        config.tmforum.catalog.apiPath = '/tmf-api/productCatalogManagement/v4';

        utils = {
            proxiedRequestHeaders: jasmine.createSpy('proxiedRequestHeaders').and.returnValue({
                accept: 'application/json'
            }),
            attachUserHeaders: jasmine.createSpy('attachUserHeaders').and.callFake(function() {})
        };
    });

    it('should aggregate offerings from search targets and preserve search order', async function() {
        const req = {
            apiUrl: '/catalog/productOffering',
            headers: {},
            connection: { remoteAddress: '127.0.0.1' }
        };
        const res = getResponseMock();
        const proxy = getProxy();

        nock('https://endpoint-a')
            .get('/tmf-api/productCatalogManagement/v4/productOffering')
            .query(function(queryObject) {
                return queryObject.href === 'offer-1,offer-3';
            })
            .reply(200, [{ id: 'offer-1', name: 'Offer 1' }, { id: 'offer-3', name: 'Offer 3' }]);

        nock('https://endpoint-b')
            .get('/tmf-api/productCatalogManagement/v4/productOffering')
            .query(function(queryObject) {
                return queryObject.href === 'offer-2';
            })
            .reply(200, [{ id: 'offer-2', name: 'Offer 2' }]);

        await proxy.get(req, res, [
            { id: 'offer-2', sourceEndpoint: 'https://endpoint-b' },
            { id: 'offer-1', sourceEndpoint: 'https://endpoint-a' },
            { id: 'offer-3', sourceEndpoint: 'https://endpoint-a/' }
        ], 'productOffering');

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([
            { id: getFederatedRef('https://endpoint-b', 'offer-2'), name: 'Offer 2' },
            { id: getFederatedRef('https://endpoint-a', 'offer-1'), name: 'Offer 1' },
            { id: getFederatedRef('https://endpoint-a', 'offer-3'), name: 'Offer 3' }
        ]);
    });

    it('should return an empty list when search targets are empty', async function() {
        const req = {
            apiUrl: '/catalog/productOffering',
            headers: {},
            connection: { remoteAddress: '127.0.0.1' }
        };
        const res = getResponseMock();
        const proxy = getProxy();

        await proxy.get(req, res, [], 'productOffering');

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should avoid duplicating catalog api path when source endpoint already includes it', async function() {
        const req = {
            apiUrl: '/catalog/productOffering',
            headers: {},
            connection: { remoteAddress: '127.0.0.1' }
        };
        const res = getResponseMock();
        const proxy = getProxy();

        nock('https://endpoint-c')
            .get('/tmf-api/productCatalogManagement/v4/productOffering')
            .query(function(queryObject) {
                return queryObject.href === 'offer-4';
            })
            .reply(200, [{ id: 'offer-4', name: 'Offer 4' }]);

        await proxy.get(req, res, [
            { id: 'offer-4', sourceEndpoint: 'https://endpoint-c/tmf-api/productCatalogManagement/v4' }
        ], 'productOffering');

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([{
            id: getFederatedRef('https://endpoint-c/tmf-api/productCatalogManagement/v4', 'offer-4'),
            name: 'Offer 4'
        }]);
    });

    it('should reject when targets are not provided', function(done) {
        const req = {
            apiUrl: '/catalog/productOffering',
            headers: {},
            connection: { remoteAddress: '127.0.0.1' }
        };
        const res = getResponseMock();
        const proxy = getProxy();

        proxy.get(req, res).then(function() {
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

    it('should aggregate catalogs from search targets', async function() {
        const req = {
            apiUrl: '/catalog/catalog',
            headers: {},
            connection: { remoteAddress: '127.0.0.1' }
        };
        const res = getResponseMock();
        const proxy = getProxy();

        nock('https://endpoint-a')
            .get('/tmf-api/productCatalogManagement/v4/catalog')
            .query(function(queryObject) {
                return queryObject.href === 'catalog-1';
            })
            .reply(200, [{ id: 'catalog-1', name: 'Catalog 1' }]);

        await proxy.get(req, res, [
            { id: 'catalog-1', sourceEndpoint: 'https://endpoint-a' }
        ], 'catalog');

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([{
            id: getFederatedRef('https://endpoint-a', 'catalog-1'),
            name: 'Catalog 1'
        }]);
    });

    it('should aggregate product orders from ordering search targets', async function() {
        const req = {
            apiUrl: '/ordering/productOrder',
            headers: {},
            connection: { remoteAddress: '127.0.0.1' }
        };
        const res = getResponseMock();
        const proxy = getProxy();

        nock('https://endpoint-ordering')
            .get('/api/productOrder')
            .query(function(queryObject) {
                return queryObject.href === 'order-1,order-2';
            })
            .reply(200, [{
                id: 'order-1',
                relatedParty: [{
                    id: 'buyer-1',
                    role: 'Buyer'
                }]
            }, {
                id: 'order-2',
                productOrderItem: [{
                    productOffering: {
                        id: 'offer-1'
                    }
                }]
            }]);

        await proxy.get(req, res, [
            { id: 'order-1', sourceEndpoint: 'https://endpoint-ordering' },
            { id: 'order-2', sourceEndpoint: 'https://endpoint-ordering' }
        ], 'productOrder', 'ordering');

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([{
            id: getFederatedRef('https://endpoint-ordering', 'order-1'),
            relatedParty: [{
                id: getFederatedRef('https://endpoint-ordering', 'buyer-1'),
                role: 'Buyer'
            }]
        }, {
            id: getFederatedRef('https://endpoint-ordering', 'order-2'),
            productOrderItem: [{
                productOffering: {
                    id: getFederatedRef('https://endpoint-ordering', 'offer-1')
                }
            }]
        }]);
    });

    it('should rewrite catalog references with source endpoint context', async function() {
        const req = {
            apiUrl: '/catalog/productOffering',
            headers: {},
            connection: { remoteAddress: '127.0.0.1' }
        };
        const res = getResponseMock();
        const proxy = getProxy();

        nock('https://endpoint-a')
            .get('/tmf-api/productCatalogManagement/v4/productOffering')
            .query(function(queryObject) {
                return queryObject.href === 'offer-1';
            })
            .reply(200, [{
                id: 'offer-1',
                href: 'https://endpoint-a/tmf-api/productCatalogManagement/v4/productOffering/offer-1',
                productSpecification: {
                    id: 'spec-1',
                    href: '/tmf-api/productCatalogManagement/v4/productSpecification/spec-1'
                }
            }]);

        await proxy.get(req, res, [
            { id: 'offer-1', sourceEndpoint: 'https://endpoint-a' }
        ], 'productOffering');

        const sourceEndpoint = 'https://endpoint-a';

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([{
            id: getFederatedRef(sourceEndpoint, 'offer-1'),
            href: 'https://endpoint-a/tmf-api/productCatalogManagement/v4/productOffering/offer-1',
            productSpecification: {
                id: getFederatedRef(sourceEndpoint, 'spec-1'),
                href: '/tmf-api/productCatalogManagement/v4/productSpecification/spec-1'
            }
        }]);
    });

    it('should reject unsupported entity', function(done) {
        const req = {
            apiUrl: '/catalog/category',
            headers: {},
            connection: { remoteAddress: '127.0.0.1' }
        };
        const res = getResponseMock();
        const proxy = getProxy();

        proxy.get(req, res, [], 'category').then(function() {
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

    it('should retrieve an entity by id from federated endpoint', async function() {
        const req = {
            apiUrl: '/catalog/productSpecification/spec-1',
            headers: {},
            connection: { remoteAddress: '127.0.0.1' }
        };
        const res = getResponseMock();
        const proxy = getProxy();
        const sourceEndpoint = 'https://endpoint-a';

        nock('https://endpoint-a')
            .get('/tmf-api/productCatalogManagement/v4/productSpecification/spec-1')
            .reply(200, {
                id: 'spec-1',
                resourceSpecification: {
                    id: 'res-spec-1'
                }
            });

        await proxy.getById(req, res, {
            api: 'catalog',
            entity: 'productSpecification',
            target: {
                id: 'spec-1',
                sourceEndpoint: sourceEndpoint
            }
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            id: getFederatedRef(sourceEndpoint, 'spec-1'),
            resourceSpecification: {
                id: getFederatedRef(sourceEndpoint, 'res-spec-1')
            }
        });
    });

    it('should reject getById when source endpoint is missing', function(done) {
        const req = {
            apiUrl: '/catalog/productSpecification/spec-1',
            headers: {},
            connection: { remoteAddress: '127.0.0.1' }
        };
        const res = getResponseMock();
        const proxy = getProxy();

        proxy.getById(req, res, {
            api: 'catalog',
            entity: 'productSpecification',
            target: {
                id: 'spec-1'
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

    it('should retrieve by id for non-catalog APIs', async function() {
        const req = {
            apiUrl: '/ordering/productOrder/order-1',
            headers: {},
            connection: { remoteAddress: '127.0.0.1' }
        };
        const res = getResponseMock();
        const proxy = getProxy();

        nock('https://endpoint-ordering')
            .get('/api/productOrder/order-1')
            .reply(200, {
                id: 'order-1'
            });

        await proxy.getById(req, res, {
            api: 'ordering',
            entity: 'productOrder',
            target: {
                id: 'order-1',
                sourceEndpoint: 'https://endpoint-ordering'
            }
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            id: getFederatedRef('https://endpoint-ordering', 'order-1')
        });
    });
});
