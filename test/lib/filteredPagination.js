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

const { filteredPagination } = require('../../lib/filteredPagination')

describe('Filtered pagination helper', function() {
    it('should request a single upstream page when all items pass the filter', function(done) {
        const fetchPage = jasmine.createSpy('fetchPage').and.returnValue(Promise.resolve([
            { id: '1' },
            { id: '2' }
        ]))

        filteredPagination.paginate({
            limit: 2,
            offset: 0,
            fetchPage: fetchPage,
            predicate: () => true
        }).then((page) => {
            expect(fetchPage.calls.count()).toBe(1)
            expect(fetchPage).toHaveBeenCalledWith(0, 2)
            expect(page.body).toEqual([
                { id: '1' },
                { id: '2' }
            ])
            expect(filteredPagination.decodeToken(page.token)).toEqual({ offset: 2 })
            done()
        }).catch(done.fail)
    })

    it('should request another upstream page when the filtered page is incomplete', function(done) {
        const fetchPage = jasmine.createSpy('fetchPage').and.callFake((offset) => {
            const pages = {
                0: [
                    { id: '1', valid: false },
                    { id: '2', valid: true }
                ],
                2: [
                    { id: '3', valid: true },
                    { id: '4', valid: true }
                ]
            }

            return Promise.resolve(pages[offset])
        })

        filteredPagination.paginate({
            limit: 2,
            offset: 0,
            fetchPage: fetchPage,
            predicate: (item) => item.valid
        }).then((page) => {
            expect(fetchPage.calls.count()).toBe(2)
            expect(fetchPage.calls.argsFor(0)).toEqual([0, 2])
            expect(fetchPage.calls.argsFor(1)).toEqual([2, 2])
            expect(page.body).toEqual([
                { id: '2', valid: true },
                { id: '3', valid: true }
            ])
            expect(filteredPagination.decodeToken(page.token)).toEqual({ offset: 3 })
            done()
        }).catch(done.fail)
    })

    it('should resume from the encoded token offset', function(done) {
        const token = filteredPagination.encodeToken(5)
        const fetchPage = jasmine.createSpy('fetchPage').and.returnValue(Promise.resolve([
            { id: '6' }
        ]))

        filteredPagination.paginate({
            limit: 1,
            offset: 0,
            token: token,
            fetchPage: fetchPage,
            predicate: () => true
        }).then((page) => {
            expect(fetchPage).toHaveBeenCalledWith(5, 1)
            expect(page.body).toEqual([{ id: '6' }])
            expect(filteredPagination.decodeToken(page.token)).toEqual({ offset: 6 })
            done()
        }).catch(done.fail)
    })

    it('should preserve the pagination fingerprint in generated tokens', function(done) {
        const fetchPage = jasmine.createSpy('fetchPage').and.returnValue(Promise.resolve([
            { id: '1' }
        ]))

        filteredPagination.paginate({
            limit: 1,
            offset: 0,
            fingerprint: 'usageSpecification|Retired,Obsolete',
            fetchPage: fetchPage,
            predicate: () => true
        }).then((page) => {
            expect(filteredPagination.decodeToken(page.token)).toEqual({
                offset: 1,
                fingerprint: 'usageSpecification|Retired,Obsolete'
            })
            done()
        }).catch(done.fail)
    })

    it('should reject a token created for a different pagination fingerprint', function(done) {
        const token = filteredPagination.encodeToken(5, 'first-filter')

        filteredPagination.paginate({
            limit: 1,
            token: token,
            fingerprint: 'second-filter',
            fetchPage: () => Promise.resolve([]),
            predicate: () => true
        }).then(() => {
            done.fail('Expected mismatched fingerprint to fail')
        }).catch((err) => {
            expect(err.status).toBe(400)
            expect(err.message).toBe('Invalid filtered pagination token')
            done()
        })
    })

    it('should read the token from lowercase headers', function() {
        const token = filteredPagination.encodeToken(5)
        const headers = {}

        headers[filteredPagination.TOKEN_HEADER_LOWER] = token

        expect(filteredPagination.getTokenFromHeaders(headers)).toBe(token)
    })

    it('should return a cursor for a full first page even when upstream is exhausted', function(done) {
        const items = Array.from({ length: 9 }, (_, index) => ({
            id: String(index),
            valid: index % 2 === 1 || index >= 6
        }))
        const fetchPage = jasmine.createSpy('fetchPage').and.callFake((offset, limit) => {
            return Promise.resolve(items.slice(offset, offset + limit))
        })
        const options = {
            limit: 6,
            offset: 0,
            fingerprint: 'six-matches',
            fetchPage: fetchPage,
            predicate: (item) => item.valid
        }

        filteredPagination.paginate(options).then((first) => {
            expect(first.body.map((item) => item.id)).toEqual(['1', '3', '5', '6', '7', '8'])
            expect(filteredPagination.decodeToken(first.token)).toEqual({
                offset: 9,
                fingerprint: 'six-matches'
            })
            return filteredPagination.paginate(Object.assign({}, options, { offset: 6, token: first.token }))
        }).then((next) => {
            expect(next.body).toEqual([])
            expect(next.token).toBeNull()
            expect(fetchPage.calls.allArgs()).toEqual([[0, 6], [6, 6], [9, 6]])
            done()
        }).catch(done.fail)
    })

    it('should return no token for a short page when upstream is exhausted', function(done) {
        filteredPagination.paginate({
            limit: 2,
            offset: 0,
            fetchPage: () => Promise.resolve([{ id: '1' }]),
            predicate: () => true
        }).then((page) => {
            expect(page.body).toEqual([{ id: '1' }])
            expect(page.token).toBeNull()
            done()
        }).catch(done.fail)
    })

    it('should return no token for an empty page when upstream is exhausted', function(done) {
        const fetchPage = jasmine.createSpy('fetchPage').and.returnValue(Promise.resolve([
            { id: '1', valid: false }
        ]))

        filteredPagination.paginate({
            limit: 2,
            offset: 0,
            fetchPage: fetchPage,
            predicate: (item) => item.valid
        }).then((page) => {
            expect(page.body).toEqual([])
            expect(page.token).toBeNull()
            done()
        }).catch(done.fail)
    })

    it('should reject invalid tokens', function(done) {
        filteredPagination.paginate({
            limit: 1,
            token: 'invalid',
            fetchPage: () => Promise.resolve([]),
            predicate: () => true
        }).then(() => {
            done.fail('Expected invalid token to fail')
        }).catch((err) => {
            expect(err.status).toBe(400)
            expect(err.message).toBe('Invalid filtered pagination token')
            done()
        })
    })
})
