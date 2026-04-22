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

describe('Federation search client', () => {
    const searchUrl = 'http://federation-search.com';
    const config = testUtils.getDefaultConfig();
    config.searchUrl = searchUrl;

    const searchClient = () => {
        return proxyquire('../../../federation/lib/search', {
            '../../config': config
        }).searchEngine;
    };

    beforeEach(() => {
        nock.cleanAll();
    });

    it('should search by keyword and return normalized ids', async (done) => {
        let receivedBody;
        nock(searchUrl)
            .post('/api/SearchProduct/data', (body) => {
                receivedBody = body;
                return true;
            })
            .reply(200, [{ id: 7 }]);

        const result = await searchClient().searchOffers('data', null, {});

        expect(receivedBody).toEqual({ categories: [] });
        expect(result).toEqual([{ id: '7' }]);
        done();
    });

    it('should split categories from comma-separated string', async (done) => {
        let receivedBody;
        nock(searchUrl)
            .post('/api/SearchProduct/ai', (body) => {
                receivedBody = body;
                return true;
            })
            .reply(200, [{ id: 'a' }]);

        await searchClient().searchOffers('ai', 'cat1, cat2 ,,cat3', {});

        expect(receivedBody).toEqual({ categories: ['cat1', 'cat2', 'cat3'] });
        done();
    });

    it('should include pagination when offset and pageSize are provided', async (done) => {
        let requestDone = false;
        nock(searchUrl)
            .post('/api/SearchProduct/edge?page=2&size=10', (body) => {
                expect(body).toEqual({ categories: [] });
                requestDone = true;
                return true;
            })
            .reply(200, []);

        await searchClient().searchOffers('edge', '', { offset: 20, pageSize: 10 });

        expect(requestDone).toBe(true);
        done();
    });

    it('should include source endpoint scope fields when provided', async (done) => {
        let receivedBody;
        nock(searchUrl)
            .post('/api/SearchProduct/federated', (body) => {
                receivedBody = body;
                return true;
            })
            .reply(200, [{ id: 'x', sourceEndpoint: 'https://endpoint-a' }]);

        const result = await searchClient().searchOffers(
            'federated',
            [],
            {},
            {
                sourceEndpoint: 'https://endpoint-a',
                sourceEndpoints: ['https://endpoint-a', 'https://endpoint-b']
            }
        );

        expect(receivedBody).toEqual({
            categories: [],
            sourceEndpoint: 'https://endpoint-a',
            sourceEndpoints: ['https://endpoint-a', 'https://endpoint-b']
        });
        expect(result).toEqual([{ id: 'x', sourceEndpoint: 'https://endpoint-a' }]);
        done();
    });

    it('should search catalogs by keyword', async (done) => {
        let receivedBody;
        nock(searchUrl)
            .post('/api/SearchCatalog/data-catalog', (body) => {
                receivedBody = body;
                return true;
            })
            .reply(200, [{ id: 'c-1', sourceEndpoint: 'https://endpoint-a' }]);

        const result = await searchClient().searchCatalogs('data-catalog', {});

        expect(receivedBody).toEqual({});
        expect(result).toEqual([{ id: 'c-1', sourceEndpoint: 'https://endpoint-a' }]);
        done();
    });

    it('should include pagination for catalog search', async (done) => {
        let requestDone = false;
        nock(searchUrl)
            .post('/api/SearchCatalog/%20?page=1&size=5', (body) => {
                expect(body).toEqual({});
                requestDone = true;
                return true;
            })
            .reply(200, []);

        await searchClient().searchCatalogs(' ', { offset: 5, pageSize: 5 });

        expect(requestDone).toBe(true);
        done();
    });

});
