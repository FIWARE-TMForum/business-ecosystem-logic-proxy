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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

const proxyquire = require('proxyquire');
const testUtils = require('../utils');
const { filteredPagination } = require('../../lib/filteredPagination');

describe('Specification lifecycle pagination through the TMF proxy', function() {
    const config = testUtils.getDefaultConfig();
    const definitions = [
        { module: 'catalog', exported: 'catalog', api: 'catalog', collection: 'productSpecification' },
        { module: 'serviceCatalog', exported: 'serviceCatalog', api: 'service', collection: 'serviceSpecification' },
        { module: 'resource', exported: 'resource', api: 'resource', collection: 'resourceSpecification' },
        { module: 'usageManagement', exported: 'usageManagement', api: 'usage', collection: 'usageSpecification' }
    ];
    const items = ['Active', 'Retired', 'Launched', 'Obsolete', 'Active', 'Retired', 'Obsolete']
        .map((status, index) => ({ id: String(index), name: 'Spec ' + index, lifecycleStatus: status }));
    const pass = (req, callback) => callback(null);

    const createProxy = function(definition) {
        const controller = proxyquire('../../controllers/tmf-apis/' + definition.module, {
            './../../config': config,
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/utils': { validateLoggedIn: pass, '@noCallThru': true },
            './../../lib/tmfUtils': { filterRelatedPartyFields: pass, ensureRelatedPartyIncluded: pass, '@noCallThru': true },
            './../../lib/store': { storeClient: {}, '@noCallThru': true },
            './../../db/schemas/accountingService': { '@noCallThru': true }
        })[definition.exported];

        const axios = jasmine.createSpyObj('axios', ['request']);
        axios.request.and.callFake((options) => {
            const params = new URL(options.url).searchParams;
            let page = items;
            if (params.has('lifecycleStatus')) {
                page = page.filter((item) => params.get('lifecycleStatus').split(',').indexOf(item.lifecycleStatus) >= 0);
            }
            const offset = Number(params.get('offset') || 0);
            const limit = Number(params.get('limit') || items.length);
            page = page.slice(offset, offset + limit);
            if (params.has('fields')) {
                page = page.map((item) => {
                    const projected = {};
                    params.get('fields').split(',').forEach((field) => { projected[field] = item[field]; });
                    return projected;
                });
            }
            return Promise.resolve({ status: 200, headers: { 'content-type': 'application/json' }, data: page });
        });

        const stubs = {
            './../config': config,
            './../lib/logger': testUtils.emptyLogger,
            './../lib/utils': {
                getAPIProtocol: () => 'http', getAPIHost: () => 'example.com',
                getAPIPort: () => 1234, getAPIPath: () => '/api',
                log: () => {}, attachUserHeaders: () => {}, proxiedRequestHeaders: () => ({}),
                '@noCallThru': true
            },
            axios: axios
        };
        stubs['./tmf-apis/' + definition.module] = { [definition.exported]: controller, '@noCallThru': true };
        const tmf = proxyquire('../../controllers/tmf', stubs).tmf();

        const request = function(query, token) {
            const path = '/' + config.endpoints[definition.api].path + '/' + definition.collection;
            const req = {
                method: 'GET', path: path, user: { partyId: 'owner' },
                query: Object.assign({}, query),
                apiUrl: path + '?' + new URLSearchParams(query).toString(),
                headers: token ? { [filteredPagination.TOKEN_HEADER_LOWER]: token } : {},
                get: () => null
            };
            req.url = req.apiUrl;
            return new Promise((resolve) => {
                const response = { headers: {}, status: 200 };
                const res = {
                    status: (status) => { response.status = status; return res; },
                    setHeader: (header, value) => { response.headers[header] = value; },
                    json: (body) => { response.body = body; resolve(response); },
                    end: () => {}
                };
                tmf.checkPermissions(req, res);
            });
        };
        return { request: request, axios: axios };
    };

    definitions.forEach((definition) => {
        describe(definition.collection, function() {
            const query = {
                lifecycleStatus: 'Retired,Obsolete', limit: '2', offset: '0',
                'relatedParty.id': 'owner', sort: '-lastUpdate', isBundle: 'false'
            };

            it('should fill pages and resume at the scanned upstream offset without duplicates or omissions', function(done) {
                const proxy = createProxy(definition);
                proxy.request(query).then((first) => {
                    expect(first.status).toBe(200);
                    expect(first.body.map((item) => item.id)).toEqual(['1', '3']);
                    const token = first.headers[filteredPagination.TOKEN_HEADER];
                    expect(filteredPagination.decodeToken(token).offset).toBe(4);
                    return proxy.request(Object.assign({}, query, { offset: '2' }), token);
                }).then((last) => {
                    expect(last.body.map((item) => item.id)).toEqual(['5', '6']);
                    expect(last.headers[filteredPagination.TOKEN_HEADER]).toBeUndefined();
                    expect(proxy.axios.request.calls.allArgs().map((args) => new URL(args[0].url).searchParams.get('offset')))
                        .toEqual(['0', '2', '4', '6']);
                    proxy.axios.request.calls.allArgs().forEach((args) => {
                        const params = new URL(args[0].url).searchParams;
                        expect(params.has('lifecycleStatus')).toBe(false);
                        expect(params.get('relatedParty.id')).toBe('owner');
                        expect(params.get('sort')).toBe('-lastUpdate');
                        expect(params.get('isBundle')).toBe('false');
                    });
                    done();
                }).catch(done.fail);
            });

            it('should reject a cursor reused with different filters before fetching upstream', function(done) {
                const proxy = createProxy(definition);
                proxy.request(query).then((first) => {
                    return proxy.request(Object.assign({}, query, { sort: 'name' }), first.headers[filteredPagination.TOKEN_HEADER]);
                }).then((response) => {
                    expect(response.status).toBe(400);
                    expect(response.body).toEqual({ error: 'Invalid filtered pagination token' });
                    expect(proxy.axios.request.calls.count()).toBe(2);
                    done();
                }).catch(done.fail);
            });

            it('should filter projected results using an internal lifecycle status field', function(done) {
                const proxy = createProxy(definition);
                proxy.request(Object.assign({}, query, { fields: 'id,name' })).then((response) => {
                    expect(response.body).toEqual([{ id: '1', name: 'Spec 1' }, { id: '3', name: 'Spec 3' }]);
                    proxy.axios.request.calls.allArgs().forEach((args) => {
                        expect(new URL(args[0].url).searchParams.get('fields')).toBe('id,name,lifecycleStatus');
                    });
                    done();
                }).catch(done.fail);
            });

            it('should preserve single-status proxy behavior', function(done) {
                const proxy = createProxy(definition);
                proxy.request(Object.assign({}, query, { lifecycleStatus: 'Retired' })).then((response) => {
                    expect(response.body.map((item) => item.id)).toEqual(['1', '5']);
                    expect(proxy.axios.request.calls.count()).toBe(1);
                    expect(new URL(proxy.axios.request.calls.argsFor(0)[0].url).searchParams.get('lifecycleStatus')).toBe('Retired');
                    expect(response.headers[filteredPagination.TOKEN_HEADER]).toBeUndefined();
                    done();
                }).catch(done.fail);
            });
        });
    });
});
