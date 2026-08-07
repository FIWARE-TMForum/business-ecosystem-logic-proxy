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

    it('should return no token when upstream is exhausted', function(done) {
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
