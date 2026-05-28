/* Copyright (c) 2024 Future Internet Consulting and Development Solutions S.L.
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

const nock = require('nock')
const proxyquire = require('proxyquire')
const testUtils = require('../utils');

describe('Search client', () => {

    const catalogUrl = 'http://catalog'
    const searchUrl = 'http://search.com'
    const config = testUtils.getDefaultConfig();
    config.searchUrl =  searchUrl

    const searchClient = (axios) => {
        return proxyquire('../../lib/search', {
            'axios': axios,
            '../config': config,
            './utils': {
                getAPIURL: function(a, b, c, path) {
                    return catalogUrl + path
                }
            }
        }).searchEngine;
    }

    const testSearch = (keyword, categories, expPath, expBody, done) => {
        let receivedBody;

        nock(searchUrl, {
        }).post(expPath, (body) => {
            receivedBody = body;
            return true;
        }).reply(200, JSON.stringify([{
            id: 'testid'
        }]));

        const client = searchClient({})
        client.search(keyword, categories, {}).then((ids) => {
            expect(ids).toEqual([{
                id: 'testid'
            }])
            expect(receivedBody).toEqual(expBody)
            done()
        })
    }

    it('should search if a keyword is provided', (done) => {
        testSearch('test', null, '/api/SearchProduct/test', {
            categories: []
        }, done)
    })

    it('should search if categories are provided', (done) => {
        nock(catalogUrl, {
        }).get(`${config.endpoints.catalog.apiPath}/category/1`, () => {
            return true;
        }).reply(200, JSON.stringify({
            name: 'cat1'
        }));

        nock(catalogUrl, {
        }).get(`${config.endpoints.catalog.apiPath}/category/2`, () => {
            return true;
        }).reply(200, JSON.stringify({
            name: 'cat2'
        }));

        testSearch('test', '1,2', '/api/SearchProduct/test', {
            categories: ['cat1', 'cat2']
        }, done)
    })

    it('should search without keyword when only filters are provided', (done) => {
        testSearch(null, 'compliance_profile::B,compliance_profile::P', '/api/SearchProduct', {
            categories: [],
            compliance_profile: ['B', 'P']
        }, done)
    })

    it('should include dynamic filters and category names in request body', (done) => {
        nock(catalogUrl, {
        }).get(`${config.endpoints.catalog.apiPath}/category/1`, () => {
            return true;
        }).reply(200, JSON.stringify({
            name: 'cat1'
        }));

        nock(catalogUrl, {
        }).get(`${config.endpoints.catalog.apiPath}/category/2`, () => {
            return true;
        }).reply(200, JSON.stringify({
            name: 'cat2'
        }));

        testSearch(
            'test',
            '1,compliance_profile::B,2,compliance_profile::P,procurementType::Ready to Buy',
            '/api/SearchProduct/test',
            {
                categories: ['cat1', 'cat2'],
                compliance_profile: ['B', 'P'],
                procurementType: ['Ready to Buy']
            },
            done
        )
    })

    it('should search if keyword and paging is provided', (done) => {
        let axios = jasmine.createSpy()
        axios.and.returnValue(Promise.resolve({
            data: []
        }))

        const client = searchClient({
            post: axios
        })

        client.search('test', '', {offset: 10, pageSize: 10}).then((ids) => {
            expect(ids).toEqual([])

            let url = 'http://search.com/api/SearchProduct/test?page=1&size=10'
            expect(axios).toHaveBeenCalledWith(url, {
                categories: []
            })
            done()
        })
    })

    it('should search without keyword if paging is provided', (done) => {
        let axios = jasmine.createSpy()
        axios.and.returnValue(Promise.resolve({
            data: []
        }))

        const client = searchClient({
            post: axios
        })

        client.search(null, '', {offset: 20, pageSize: 10}).then((ids) => {
            expect(ids).toEqual([])

            let url = 'http://search.com/api/SearchProduct?page=2&size=10'
            expect(axios).toHaveBeenCalledWith(url, {
                categories: []
            })
            done()
        })
    })
})
