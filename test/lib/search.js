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

describe('Search client', () => {

    const catalogUrl = 'http://catalog'
    const searchUrl = 'http://search.com'
    const config = {
        searchUrl: searchUrl
    }

    const searchClient = () => {
        return proxyquire('../../lib/search', {
            '../config': config,
            './utils': {
                getAPIURL: function(a, b, c, path) {
                    return catalogUrl + path
                }
            }
        }).searchEngine;
    }

    const testSearch = (keyword, categories, expBody, done) => {
        let receivedBody;

        nock(searchUrl, {
        }).post(`/api/SearchProductsByKeywords/${keyword}`, (body) => {
            receivedBody = body;
            return true;
        }).reply(200, JSON.stringify([{
            id: 'testid'
        }]));

        const client = searchClient()
        client.search(keyword, categories).then((ids) => {
            expect(ids).toEqual([{
                id: 'testid'
            }])
            expect(receivedBody).toEqual(expBody)
            done()
        })
    }

    it('should search if a keyword is provided', (done) => {
        testSearch('test', null, {}, done)
    })

    it('should search if categories are provided', (done) => {
        nock(catalogUrl, {
        }).get('/category/1', () => {
            return true;
        }).reply(200, JSON.stringify({
            name: 'cat1'
        }));

        nock(catalogUrl, {
        }).get('/category/2', () => {
            return true;
        }).reply(200, JSON.stringify({
            name: 'cat2'
        }));

        testSearch('test', '1,2', {
            categories: ['cat1', 'cat2']
        }, done)
    })
})