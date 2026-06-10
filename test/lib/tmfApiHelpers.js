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
const testUtils = require('../utils');

describe('TMF API Helpers', function() {
    let config;
    let axios;

    const getHelpers = function() {
        return proxyquire('../../lib/tmfApiHelpers', {
            './../config': config,
            axios: axios
        }).tmfApiHelpers;
    };

    beforeEach(function() {
        config = testUtils.getDefaultConfig();
        config.federationEnabled = true;
        axios = jasmine.createSpyObj('axios', ['get', 'post', 'patch']);
    });

    it('should use request federation context for getAsset helper calls', function(done) {
        axios.get.and.returnValue(Promise.resolve({
            status: 200,
            data: {
                id: 'urn:product-offering:1'
            }
        }));

        const req = {
            federationContext: {
                tmforumEndpoint: 'https://seller.example.com/tmf'
            }
        };

        getHelpers().getAsset(config.tmforum.catalog, '/productOffering/1', function(err, result) {
            expect(err).toBe(null);
            expect(result.status).toBe(200);
            expect(axios.get).toHaveBeenCalledWith('https://seller.example.com/tmf/api/productOffering/1');
            done();
        }, req);
    });

    it('should use request federation context for createAsset helper calls', function(done) {
        axios.post.and.returnValue(Promise.resolve({
            status: 201,
            data: {
                id: 'urn:product-offering:1'
            }
        }));

        const req = {
            federationContext: {
                tmforumEndpoint: 'https://seller.example.com/tmf/'
            }
        };
        const body = {
            name: 'Offering'
        };

        getHelpers().createAsset(config.tmforum.catalog, '/productOffering', body, function(err, result) {
            expect(err).toBe(null);
            expect(result.status).toBe(201);
            expect(axios.post).toHaveBeenCalledWith('https://seller.example.com/tmf/api/productOffering', body);
            done();
        }, req);
    });

    it('should use request federation context for updateAsset helper calls', function(done) {
        axios.patch.and.returnValue(Promise.resolve({
            status: 200,
            data: {
                id: 'urn:product-offering:1'
            }
        }));

        const req = {
            federationContext: {
                tmforumEndpoint: 'https://seller.example.com/tmf'
            }
        };
        const body = {
            lifecycleStatus: 'Launched'
        };

        getHelpers().updateAsset(config.tmforum.catalog, '/productOffering/1', body, function(err, result) {
            expect(err).toBe(null);
            expect(result.status).toBe(200);
            expect(axios.patch).toHaveBeenCalledWith('https://seller.example.com/tmf/api/productOffering/1', body);
            done();
        }, req);
    });

    it('should use request federation context for getAssetById helper calls', async function() {
        axios.get.and.returnValue(Promise.resolve({
            status: 200,
            data: {
                id: 'urn:product-offering:1'
            }
        }));

        const req = {
            federationContext: {
                tmforumEndpoint: 'https://seller.example.com/tmf'
            }
        };

        const result = await getHelpers().getAssetById(
            config.tmforum.catalog,
            'productOffering',
            'urn:product-offering:1',
            req
        );

        expect(result.status).toBe(200);
        expect(result.sourceEndpoint).toBe('https://seller.example.com/tmf');
        expect(result.federated).toBe(true);
        expect(axios.get).toHaveBeenCalledWith(
            'https://seller.example.com/tmf/api/productOffering/urn%3Aproduct-offering%3A1'
        );
    });

    it('should use local endpoint when no request federation context exists', function(done) {
        axios.get.and.returnValue(Promise.resolve({
            status: 200,
            data: {
                id: 'urn:product-offering:1'
            }
        }));

        const req = {
            user: {
                partyId: 'urn:organization:buyer'
            }
        };

        getHelpers().getAsset(config.tmforum.catalog, '/productOffering/1', function(err) {
            expect(err).toBe(null);
            expect(axios.get).toHaveBeenCalledWith('http://catalog.com:99/api/productOffering/1');
            done();
        }, req);
    });
});
