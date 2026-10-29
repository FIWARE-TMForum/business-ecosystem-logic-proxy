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

const { createSpecificationLifecycleFilter } = require('../../lib/specificationLifecycleFilter');

describe('Specification lifecycle filter', function() {
    let filter;

    beforeEach(function() {
        filter = createSpecificationLifecycleFilter('productSpecification');
    });

    const request = function(query) {
        return {
            method: 'GET',
            apiUrl: '/catalog/productSpecification?' + new URLSearchParams(query).toString(),
            query: Object.assign({}, query)
        };
    };

    it('should preserve other filters and bind the cursor to the collection, filters and normalized statuses', function() {
        const req = request({
            lifecycleStatus: ' Obsolete, RETIRED ', limit: '2', offset: '0',
            'relatedParty.id': 'party & one', sort: '-lastUpdate', isBundle: 'true'
        });
        filter.prepare(req, () => {});
        const params = new URL('http://example.com' + req.apiUrl).searchParams;
        const config = filter.getFilteredPaginationConfig(req);

        expect(params.has('lifecycleStatus')).toBe(false);
        expect(req.query.lifecycleStatus).toBeUndefined();
        expect(params.get('relatedParty.id')).toBe('party & one');
        expect(params.get('sort')).toBe('-lastUpdate');
        expect(params.get('isBundle')).toBe('true');
        expect(config.predicate({ lifecycleStatus: 'Retired' })).toBe(true);
        expect(config.predicate({ lifecycleStatus: 'OBSOLETE' })).toBe(true);
        expect(config.predicate({ lifecycleStatus: 'Active' })).toBe(false);
        expect(config.predicate({})).toBe(false);

        const next = request({
            lifecycleStatus: 'Retired,Obsolete', limit: '5', offset: '20',
            'relatedParty.id': 'party & one', sort: '-lastUpdate', isBundle: 'true'
        });
        filter.prepare(next, () => {});
        expect(filter.getFilteredPaginationConfig(next).fingerprint).toBe(config.fingerprint);

        next.query = Object.assign({}, next.query, { lifecycleStatus: 'Retired,Obsolete', sort: 'name' });
        next.apiUrl = '/catalog/productSpecification?' + new URLSearchParams(next.query).toString();
        filter.prepare(next, () => {});
        expect(filter.getFilteredPaginationConfig(next).fingerprint).not.toBe(config.fingerprint);
    });

    [undefined, '', '0', '-1', 'invalid'].forEach((limit) => {
        it('should retain the upstream status filter when limit is ' + String(limit), function() {
            const query = { lifecycleStatus: 'Retired,Obsolete' };
            if (limit !== undefined) {
                query.limit = limit;
            }
            const req = request(query);
            const originalUrl = req.apiUrl;
            filter.prepare(req, () => {});
            expect(req.apiUrl).toBe(originalUrl);
            expect(req.query.lifecycleStatus).toBe('Retired,Obsolete');
            expect(filter.getFilteredPaginationConfig(req)).toBeNull();
        });
    });

    it('should leave single-status queries unchanged', function() {
        const req = request({ lifecycleStatus: 'Retired', limit: '2' });
        const originalUrl = req.apiUrl;
        filter.prepare(req, () => {});
        expect(req.apiUrl).toBe(originalUrl);
        expect(filter.getFilteredPaginationConfig(req)).toBeNull();
    });

    ['POST', 'PATCH'].forEach((method) => {
        it('should leave ' + method + ' requests unchanged', function() {
            const req = request({ lifecycleStatus: 'Retired,Obsolete', limit: '2' });
            req.method = method;
            filter.prepare(req, () => {});
            expect(req.query.lifecycleStatus).toBe('Retired,Obsolete');
            expect(filter.getFilteredPaginationConfig(req)).toBeNull();
        });
    });

    ['/catalog/productSpecification/id', '/catalog/productOffering', '/catalog/productSpecification/id/relationship'].forEach((path) => {
        it('should leave unrelated or individual resource requests unchanged: ' + path, function() {
            const req = request({ lifecycleStatus: 'Retired,Obsolete', limit: '2' });
            req.apiUrl = req.apiUrl.replace('/catalog/productSpecification', path);
            filter.prepare(req, () => {});
            expect(req.query.lifecycleStatus).toBe('Retired,Obsolete');
            expect(filter.getFilteredPaginationConfig(req)).toBeNull();
        });
    });

    it('should support array statuses and collection paths ending in a slash', function() {
        const req = request({ lifecycleStatus: ['Retired', 'Obsolete'], limit: '2' });
        req.apiUrl = req.apiUrl.replace('productSpecification?', 'productSpecification/?');
        filter.prepare(req, () => {});
        expect(filter.getFilteredPaginationConfig(req).predicate({ lifecycleStatus: 'Obsolete' })).toBe(true);
    });

    it('should read query parameters from the URL when req.query is absent', function() {
        const req = request({ lifecycleStatus: 'Retired,Obsolete', limit: '2' });
        delete req.query;
        filter.prepare(req, () => {});
        expect(filter.getFilteredPaginationConfig(req)).not.toBeNull();
        expect(req.apiUrl).toBe('/catalog/productSpecification?limit=2');
    });

    it('should fetch status internally and restore the requested fields without mutating upstream items', function() {
        const req = request({ lifecycleStatus: 'Retired,Obsolete', limit: '2', fields: 'id,name' });
        filter.prepare(req, () => {});
        const config = filter.getFilteredPaginationConfig(req);
        expect(new URL('http://example.com' + req.apiUrl).searchParams.get('fields')).toBe('id,name,lifecycleStatus');
        expect(req.query.fields).toBe('id,name,lifecycleStatus');
        const item = { id: '1', name: 'One', lifecycleStatus: 'Retired' };
        expect(config.predicate(item)).toBe(true);
        expect(config.transformItem(item)).toEqual({ id: '1', name: 'One' });
        expect(item.lifecycleStatus).toBe('Retired');
    });

    it('should retain explicitly requested status fields', function() {
        const req = request({ lifecycleStatus: 'Retired,Obsolete', limit: '2', fields: 'name,lifecycleStatus' });
        filter.prepare(req, () => {});
        expect(req.query.fields).toBe('name,lifecycleStatus');
        expect(filter.getFilteredPaginationConfig(req).transformItem).toBeUndefined();
    });
});
