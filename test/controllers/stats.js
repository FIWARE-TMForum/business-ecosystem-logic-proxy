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

const proxyquire = require('proxyquire');

describe('Stats Controller', () => {

    const apiPath= ''
    const utils = {
        getAPIProtocol: function() {
            return 'https';
        },
        getAPIPort: function() {
            return 1234;
        },
        getAPIPath: function() {
            return apiPath;
        },
        getAPIHost: function() {
            return 'example.com';
        }
    }

    const getStatsInstance = function (axios, cron, schema) {
        let mocks = {
            'axios': axios,
            'node-cron': cron,
            '../lib/utils': utils,
            '../db/schemas/stats': schema
        }

        return proxyquire('../../controllers/stats', mocks).stats()
    }

    it('should load stats when init is called', (done) => {
        // Mock axios
        const axios = jasmine.createSpyObj('axios', ['request'])
        axios.request.and.returnValues(Promise.resolve({
            data: [{
                'name': 'offering1'
            }, {
                'name': 'offering2'
            }, {
                'name': 'offering3'
            }]
        }), Promise.resolve({
            data: [{
                'name': 'offering4'
            }]
        }), Promise.resolve({
            data: []
        }), Promise.resolve({
            data: [{
                'tradingName': 'party1'
            }]
        }), Promise.resolve({
            data: []
        }))

        const cron = jasmine.createSpyObj('node-cron', ['schedule'])
        const schema = jasmine.createSpyObj('node-cron', ['findOne'])
        const dbObject = {
            services: [],
            organizations: [],
            save: () => {}
        }

        spyOn(dbObject, 'save')

        schema.findOne.and.returnValue(Promise.resolve(dbObject))

        const instance = getStatsInstance(axios, cron, schema)

        instance.init().then(() => {
            // Check the calls
            expect(axios.request).toHaveBeenCalledTimes(5); // Check the number of calls

            expect(axios.request.calls.argsFor(0)).toEqual([{
                url: 'https://example.com:1234/productOffering?lifecycleStatus=Launched&fields=name&offset=0&limit=50',
                method: 'GET'
            }]);

            expect(axios.request.calls.argsFor(1)).toEqual([{
                url: 'https://example.com:1234/productOffering?lifecycleStatus=Launched&fields=name&offset=50&limit=50',
                method: 'GET'
            }]);

            expect(axios.request.calls.argsFor(2)).toEqual([{
                url: 'https://example.com:1234/productOffering?lifecycleStatus=Launched&fields=name&offset=100&limit=50',
                method: 'GET'
            }]);

            expect(axios.request.calls.argsFor(3)).toEqual([{
                url: 'https://example.com:1234/organization?fields=tradingName&offset=0&limit=50',
                method: 'GET'
            }]);

            expect(axios.request.calls.argsFor(4)).toEqual([{
                url: 'https://example.com:1234/organization?fields=tradingName&offset=50&limit=50',
                method: 'GET'
            }]);

            expect(dbObject.services).toEqual(['offering1', 'offering2', 'offering3', 'offering4'])
            expect(dbObject.organizations).toEqual(['party1'])

            expect(dbObject.save).toHaveBeenCalled()
            done()
        })
    })
})