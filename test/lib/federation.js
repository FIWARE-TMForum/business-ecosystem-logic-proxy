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

describe('Federation library', function() {
    const getFederation = function(partyClient) {
        return proxyquire('../../lib/federation', {
            './party': {
                partyClient: partyClient
            },
            './logger': testUtils.emptyLogger
        }).federation;
    };

    it('should keep API URL for individual users and skip party lookup', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization')
        };
        const federation = getFederation(partyClient);

        const req = {
            apiUrl: '/catalog/productOffering',
            user: {
                id: 'individual-1',
                partyId: 'urn:individual:1'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(req, '/catalog/productOffering');

        expect(resolved).toBe('/catalog/productOffering');
        expect(partyClient.getOrganization).not.toHaveBeenCalled();
    });

    it('should skip federation resolution for party API requests', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization')
        };
        const federation = getFederation(partyClient);

        const req = {
            apiUrl: '/party/organization/urn:organization:1',
            user: {
                id: 'org-1',
                userId: 'individual-1',
                partyId: 'urn:organization:1'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(req, '/party/organization/urn:organization:1');

        expect(resolved).toBe('');
        expect(partyClient.getOrganization).not.toHaveBeenCalled();
    });

    it('should keep API URL for organization users without TMForum endpoint characteristic', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.returnValue(
                Promise.resolve({
                    body: {
                        id: 'urn:organization:1',
                        partyCharacteristic: [
                            { name: 'country', value: 'ES' }
                        ]
                    }
                })
            )
        };
        const federation = getFederation(partyClient);

        const req = {
            apiUrl: '/catalog/productOffering',
            user: {
                id: 'org-1',
                userId: 'individual-1',
                partyId: 'urn:organization:1'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(req, '/catalog/productOffering');

        expect(resolved).toBe('/catalog/productOffering');
        expect(partyClient.getOrganization).toHaveBeenCalledWith('urn:organization:1');
    });

    it('should build a new API URL from organization TMForum endpoint characteristic', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.returnValue(
                Promise.resolve({
                    body: {
                        id: 'urn:organization:1',
                        partyCharacteristic: [
                            { name: 'tmforum endpoint', value: 'https://federated.example.com/tmf/' }
                        ]
                    }
                })
            )
        };
        const federation = getFederation(partyClient);

        const req = {
            apiUrl: '/catalog/productOffering?lifecycleStatus=Active',
            user: {
                id: 'org-1',
                userId: 'individual-1',
                partyId: 'urn:organization:1'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(req, '/catalog/productOffering?lifecycleStatus=Active');

        expect(resolved).toBe('https://federated.example.com/tmf/catalog/productOffering?lifecycleStatus=Active');
    });

    it('should use apiUrl argument as source path when it is absolute', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.returnValue(
                Promise.resolve({
                    body: {
                        id: 'urn:organization:1',
                        partyCharacteristic: [
                            { name: 'tmforumEndpoint', value: 'https://federated.example.com/tmf/' }
                        ]
                    }
                })
            )
        };
        const federation = getFederation(partyClient);

        const req = {
            apiUrl: '/catalog/productOffering?lifecycleStatus=Active',
            user: {
                id: 'org-1',
                userId: 'individual-1',
                partyId: 'urn:organization:1'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(
            req,
            'http://local.example:1234/tmf-api/productCatalogManagement/v4/productOffering?lifecycleStatus=Active'
        );

        expect(resolved).toBe(
            'https://federated.example.com/tmf/tmf-api/productCatalogManagement/v4/productOffering?lifecycleStatus=Active'
        );
    });

    it('should keep API URL when organization party lookup fails', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.returnValue(
                Promise.reject({ message: 'Party API unavailable' })
            )
        };
        const federation = getFederation(partyClient);

        const req = {
            apiUrl: '/catalog/productOffering',
            user: {
                id: 'org-1',
                userId: 'individual-1',
                partyId: 'urn:organization:1'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(req, '/catalog/productOffering');

        expect(resolved).toBe('/catalog/productOffering');
    });

    it('should route product order creation using seller federation endpoint', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.callFake((partyId) => {
                if (partyId === 'urn:organization:seller') {
                    return Promise.resolve({
                        body: {
                            id: 'urn:organization:seller',
                            partyCharacteristic: [
                                { name: 'tmforumEndpoint', value: 'https://seller.example.com/tmf/' }
                            ]
                        }
                    });
                }

                return Promise.resolve({
                    body: {
                        id: 'urn:organization:buyer',
                        partyCharacteristic: [
                            { name: 'tmforumEndpoint', value: 'https://buyer.example.com/tmf/' }
                        ]
                    }
                });
            })
        };
        const federation = getFederation(partyClient);

        const req = {
            method: 'POST',
            apiUrl: '/ordering/productOrder',
            body: JSON.stringify({
                relatedParty: [{
                    id: 'urn:organization:seller',
                    role: 'Seller'
                }, {
                    id: 'urn:organization:buyer',
                    role: 'Customer'
                }]
            }),
            user: {
                id: 'buyer-user',
                userId: 'individual-buyer',
                partyId: 'urn:organization:buyer'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(req, '/ordering/productOrder');

        expect(resolved).toBe('https://seller.example.com/tmf/ordering/productOrder');
        expect(partyClient.getOrganization).toHaveBeenCalledWith('urn:organization:seller');
        expect(partyClient.getOrganization).not.toHaveBeenCalledWith('urn:organization:buyer');
    });

    it('should preserve backend product order path when apiUrl argument is absolute', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.returnValue(
                Promise.resolve({
                    body: {
                        id: 'urn:organization:seller',
                        partyCharacteristic: [
                            { name: 'tmforumEndpoint', value: 'https://seller.example.com/tmf/' }
                        ]
                    }
                })
            )
        };
        const federation = getFederation(partyClient);

        const req = {
            method: 'POST',
            apiUrl: '/ordering/productOrder',
            body: JSON.stringify({
                relatedParty: [{
                    id: 'urn:organization:seller',
                    role: 'Seller'
                }]
            }),
            user: {
                id: 'buyer-user',
                userId: 'individual-buyer',
                partyId: 'urn:organization:buyer'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(
            req,
            'http://local.example:1234/tmf-api/productOrderingManagement/v4/productOrder'
        );

        expect(resolved).toBe('https://seller.example.com/tmf/tmf-api/productOrderingManagement/v4/productOrder');
    });

    it('should fallback to seller external reference name when seller id is not resolvable', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.callFake((partyId) => {
                if (partyId === 'urn:organization:local-seller') {
                    return Promise.resolve({
                        body: {
                            id: 'urn:organization:local-seller',
                            partyCharacteristic: [
                                { name: 'tmforumEndpoint', value: 'https://seller.example.com/tmf/' }
                            ]
                        }
                    });
                }

                return Promise.resolve({
                    body: {
                        id: 'urn:organization:remote-seller',
                        partyCharacteristic: []
                    }
                });
            }),
            getOrganizationsByQuery: jasmine.createSpy('getOrganizationsByQuery').and.returnValue(
                Promise.resolve({
                    body: [{
                        id: 'urn:organization:local-seller',
                        partyCharacteristic: [
                            { name: 'tmforumEndpoint', value: 'https://seller.example.com/tmf/' }
                        ]
                    }]
                })
            )
        };
        const federation = getFederation(partyClient);

        const req = {
            method: 'POST',
            apiUrl: '/ordering/productOrder',
            body: JSON.stringify({
                relatedParty: [{
                    id: 'urn:organization:remote-seller',
                    role: 'Seller',
                    name: 'VATES-SELLER'
                }]
            }),
            user: {
                id: 'buyer-user',
                userId: 'individual-buyer',
                partyId: 'urn:organization:buyer'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(req, '/ordering/productOrder');

        expect(resolved).toBe('https://seller.example.com/tmf/ordering/productOrder');
        expect(partyClient.getOrganization).toHaveBeenCalledWith('urn:organization:remote-seller');
        expect(partyClient.getOrganizationsByQuery).toHaveBeenCalledWith('externalReference.name=VATES-SELLER');

        const resolvedFromCache = await federation.resolveTmforumApiUrl(req, '/ordering/productOrder');
        expect(resolvedFromCache).toBe('https://seller.example.com/tmf/ordering/productOrder');
        expect(partyClient.getOrganizationsByQuery.calls.count()).toBe(1);
    });

    it('should fail when seller is missing in product order creation', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.returnValue(
                Promise.resolve({
                    body: {
                        id: 'urn:organization:buyer',
                        partyCharacteristic: [
                            { name: 'tmforumEndpoint', value: 'https://buyer.example.com/tmf/' }
                        ]
                    }
                })
            )
        };
        const federation = getFederation(partyClient);

        const req = {
            method: 'POST',
            apiUrl: '/ordering/productOrder',
            body: JSON.stringify({
                relatedParty: [{
                    id: 'urn:organization:buyer',
                    role: 'Customer'
                }]
            }),
            user: {
                id: 'buyer-user',
                userId: 'individual-buyer',
                partyId: 'urn:organization:buyer'
            }
        };

        try {
            await federation.resolveTmforumApiUrl(req, '/ordering/productOrder');
            fail('Expected resolveTmforumApiUrl to fail when seller is missing');
        } catch (err) {
            expect(err).toEqual({
                status: 422,
                message: 'Product order federation requires a seller relatedParty'
            });
        }

        expect(partyClient.getOrganization).not.toHaveBeenCalled();
    });

    it('should fail when seller endpoint cannot be resolved in product order creation', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.returnValue(
                Promise.resolve({
                    body: {
                        id: 'urn:organization:seller',
                        partyCharacteristic: []
                    }
                })
            )
        };
        const federation = getFederation(partyClient);

        const req = {
            method: 'POST',
            apiUrl: '/ordering/productOrder',
            body: JSON.stringify({
                relatedParty: [{
                    id: 'urn:organization:seller',
                    role: 'Seller'
                }]
            }),
            user: {
                id: 'buyer-user',
                userId: 'individual-buyer',
                partyId: 'urn:organization:buyer'
            }
        };

        try {
            await federation.resolveTmforumApiUrl(req, '/ordering/productOrder');
            fail('Expected resolveTmforumApiUrl to fail when seller endpoint is missing');
        } catch (err) {
            expect(err).toEqual({
                status: 422,
                message: 'Cannot resolve TMForum endpoint for seller urn:organization:seller'
            });
        }
    });

    it('should resolve TMForum endpoint by organization party id', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.returnValue(
                Promise.resolve({
                    body: {
                        id: 'urn:organization:1',
                        partyCharacteristic: [
                            { name: 'tmforumEndpoint', value: 'https://federated.example.com/tmf/' }
                        ]
                    }
                })
            )
        };
        const federation = getFederation(partyClient);

        const resolved = await federation.resolveTmforumEndpointByPartyId('urn:organization:1');

        expect(resolved).toBe('https://federated.example.com/tmf/');
        expect(partyClient.getOrganization).toHaveBeenCalledWith('urn:organization:1');
    });

    it('should skip endpoint resolution by party id for individuals', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization')
        };
        const federation = getFederation(partyClient);

        const resolved = await federation.resolveTmforumEndpointByPartyId('urn:individual:1');

        expect(resolved).toBe('');
        expect(partyClient.getOrganization).not.toHaveBeenCalled();
    });

    it('should build TMForum API URL by organization party id', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.returnValue(
                Promise.resolve({
                    body: {
                        id: 'urn:organization:1',
                        partyCharacteristic: [
                            { name: 'tmforumEndpoint', value: 'https://federated.example.com/tmf/' }
                        ]
                    }
                })
            )
        };
        const federation = getFederation(partyClient);

        const resolved = await federation.resolveTmforumApiUrlByPartyId('/ordering/productOrder', 'urn:organization:1');

        expect(resolved).toBe('https://federated.example.com/tmf/ordering/productOrder');
    });

    it('should resolve federated organization by external reference and reuse cache by local party id', async function() {
        const partyClient = {
            getOrganizationsByQueryInApi: jasmine.createSpy('getOrganizationsByQueryInApi').and.returnValue(
                Promise.resolve({
                    body: [{
                        id: 'urn:organization:remote-seller',
                        href: 'urn:organization:remote-seller'
                    }]
                })
            )
        };
        const federation = getFederation(partyClient);

        const resolved1 = await federation.resolveFederatedOrganizationParty(
            'https://federated.example.com/tmf',
            'urn:organization:local-seller',
            'VAT-SELLER'
        );
        const resolved2 = await federation.resolveFederatedOrganizationParty(
            'https://federated.example.com/tmf',
            'urn:organization:local-seller',
            'VAT-SELLER'
        );

        expect(resolved1).toEqual({
            id: 'urn:organization:remote-seller',
            href: 'urn:organization:remote-seller'
        });
        expect(resolved2).toEqual({
            id: 'urn:organization:remote-seller',
            href: 'urn:organization:remote-seller'
        });
        expect(partyClient.getOrganizationsByQueryInApi.calls.count()).toBe(1);
        expect(partyClient.getOrganizationsByQueryInApi).toHaveBeenCalledWith(
            'https://federated.example.com/tmf',
            'externalReference.name=VAT-SELLER'
        );
    });

    it('should fail when federated organization lookup is not unique', async function() {
        const partyClient = {
            getOrganizationsByQueryInApi: jasmine.createSpy('getOrganizationsByQueryInApi').and.returnValue(
                Promise.resolve({
                    body: []
                })
            )
        };
        const federation = getFederation(partyClient);

        try {
            await federation.resolveFederatedOrganizationParty(
                'https://federated.example.com/tmf',
                'urn:organization:local-seller',
                'VAT-SELLER'
            );
            fail('Expected federated organization lookup to fail with zero matches');
        } catch (err) {
            expect(err).toEqual({
                status: 422,
                message: 'Cannot resolve unique federated organization for externalReference.name=VAT-SELLER. matches=0'
            });
        }
    });

});
