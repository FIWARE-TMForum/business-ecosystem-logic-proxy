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
    const getFederatedId = function(sourceEndpoint, id) {
        const token = Buffer.from(JSON.stringify({
            sourceEndpoint: sourceEndpoint,
            id: id
        })).toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        return `federationRef::${token}`;
    };

    const getFederation = function(partyClient) {
        return proxyquire('../../federation/lib/federation', {
            '../../lib/party': {
                partyClient: partyClient
            },
            '../../lib/logger': testUtils.emptyLogger
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

    it('should rewrite relatedParty query filters to remote party ids', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.callFake((partyId) => {
                if (partyId === 'urn:organization:local-seller') {
                    return Promise.resolve({
                        body: {
                            id: partyId,
                            partyCharacteristic: [
                                { name: 'tmforumEndpoint', value: 'https://federated.example.com/tmf/' }
                            ],
                            externalReference: [{
                                externalReferenceType: 'idm_id',
                                name: 'VAT-SELLER'
                            }]
                        }
                    });
                }

                return Promise.resolve({
                    body: {
                        id: partyId,
                        partyCharacteristic: [
                            { name: 'tmforumEndpoint', value: 'https://federated.example.com/tmf/' }
                        ]
                    }
                });
            }),
            getOrganizationsByQueryInApi: jasmine.createSpy('getOrganizationsByQueryInApi').and.returnValue(
                Promise.resolve({
                    body: [{
                        id: 'urn:organization:remote-seller'
                    }]
                })
            )
        };
        const federation = getFederation(partyClient);

        const req = {
            apiUrl: '/catalog/productOffering?relatedParty.id=urn:organization:local-seller&relatedParty.href=urn:organization:local-seller&relatedParty=urn:organization:local-seller',
            user: {
                id: 'requester',
                userId: 'individual-requester',
                partyId: 'urn:organization:requester'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(req, req.apiUrl);

        expect(resolved).toBe(
            'https://federated.example.com/tmf/catalog/productOffering?relatedParty.id=urn%3Aorganization%3Aremote-seller&relatedParty.href=urn%3Aorganization%3Aremote-seller&relatedParty=urn%3Aorganization%3Aremote-seller'
        );
        expect(partyClient.getOrganizationsByQueryInApi.calls.count()).toBe(1);
        expect(partyClient.getOrganizationsByQueryInApi).toHaveBeenCalledWith(
            'https://federated.example.com/tmf/',
            'externalReference.name=VAT-SELLER'
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

    it('should resolve endpoint from federated ID in path and forward the raw ID', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization')
        };
        const federation = getFederation(partyClient);
        const federatedId = getFederatedId(
            'https://seller.example.com/tmf',
            'urn:ngsi-ld:billing-account:1'
        );
        const targetId = getFederatedId(
            'https://ignored.example.com/tmf',
            'urn:ngsi-ld:product-offering:1'
        );

        const req = {
            apiUrl: `/account/billingAccount/${federatedId}?target=${targetId}&fields=name`,
            user: {
                id: 'buyer-user',
                userId: 'individual-buyer',
                partyId: 'urn:organization:buyer'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(
            req,
            `http://local.example:1234/tmf-api/accountManagement/v4/billingAccount/${federatedId}?target=${targetId}&fields=name`
        );

        expect(resolved).toBe(
            'https://seller.example.com/tmf/tmf-api/accountManagement/v4/billingAccount/urn:ngsi-ld:billing-account:1?fields=name'
        );
        expect(partyClient.getOrganization).not.toHaveBeenCalled();
    });

    it('should resolve endpoint from federated target query param and strip target before forwarding', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization')
        };
        const federation = getFederation(partyClient);
        const targetId = getFederatedId(
            'https://seller.example.com/tmf',
            'urn:ngsi-ld:product-offering:1'
        );

        const req = {
            apiUrl: `/account/billingAccount?limit=1&target=${targetId}&offset=0`,
            user: {
                id: 'buyer-user',
                userId: 'individual-buyer',
                partyId: 'urn:organization:buyer'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(
            req,
            `http://local.example:1234/tmf-api/accountManagement/v4/billingAccount?limit=1&target=${targetId}&offset=0`
        );

        expect(resolved).toBe(
            'https://seller.example.com/tmf/tmf-api/accountManagement/v4/billingAccount?limit=1&offset=0'
        );
        expect(req.federationContext).toEqual({
            tmforumEndpoint: 'https://seller.example.com/tmf'
        });
        expect(partyClient.getOrganization).not.toHaveBeenCalled();
    });

    it('should set request federation context from target without rewriting apiUrl', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization')
        };
        const federation = getFederation(partyClient);
        const targetId = getFederatedId(
            'https://seller.example.com/tmf',
            'urn:ngsi-ld:product-offering:1'
        );

        const req = {
            apiUrl: `/ordering/productOrder?target=${targetId}`,
            user: {
                id: 'buyer-user',
                partyId: 'urn:individual:buyer'
            }
        };

        const context = await federation.setRequestFederationContextFromApiUrl(req, req.apiUrl);

        expect(context).toEqual({
            tmforumEndpoint: 'https://seller.example.com/tmf'
        });
        expect(req.federationContext).toEqual(context);
        expect(req.apiUrl).toBe(`/ordering/productOrder?target=${targetId}`);
        expect(partyClient.getOrganization).not.toHaveBeenCalled();
    });

    it('should set request federation context from path reference without rewriting apiUrl', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization')
        };
        const federation = getFederation(partyClient);
        const federatedId = getFederatedId(
            'https://seller.example.com/tmf',
            'urn:ngsi-ld:product-offering:1'
        );

        const req = {
            apiUrl: `/catalog/productOffering/${federatedId}`,
            user: {
                id: 'buyer-user',
                partyId: 'urn:individual:buyer'
            }
        };

        const context = await federation.setRequestFederationContextFromApiUrl(req, req.apiUrl);

        expect(context).toEqual({
            tmforumEndpoint: 'https://seller.example.com/tmf'
        });
        expect(req.federationContext).toEqual(context);
        expect(req.apiUrl).toBe(`/catalog/productOffering/${federatedId}`);
        expect(partyClient.getOrganization).not.toHaveBeenCalled();
    });

    it('should not set request federation context for party API target requests', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization')
        };
        const federation = getFederation(partyClient);
        const targetId = getFederatedId(
            'https://seller.example.com/tmf',
            'urn:ngsi-ld:billing-account:1'
        );

        const req = {
            apiUrl: `/party/organization?target=${targetId}`,
            user: {
                id: 'buyer-user',
                partyId: 'urn:individual:buyer'
            }
        };

        const context = await federation.setRequestFederationContextFromApiUrl(req, req.apiUrl);

        expect(context).toBe(null);
        expect(req.federationContext).toBeUndefined();
        expect(req.apiUrl).toBe(`/party/organization?target=${targetId}`);
        expect(partyClient.getOrganization).not.toHaveBeenCalled();
    });

    it('should rewrite relatedParty query filters using the target endpoint context', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.returnValue(
                Promise.resolve({
                    body: {
                        id: 'urn:organization:buyer',
                        partyCharacteristic: [
                            { name: 'tmforumEndpoint', value: 'https://buyer-own.example.com/tmf/' }
                        ],
                        externalReference: [{
                            externalReferenceType: 'idm_id',
                            name: 'VAT-BUYER'
                        }]
                    }
                })
            ),
            getOrganizationsByQueryInApi: jasmine.createSpy('getOrganizationsByQueryInApi').and.returnValue(
                Promise.resolve({
                    body: [{
                        id: 'urn:organization:buyer-in-provider'
                    }]
                })
            )
        };
        const federation = getFederation(partyClient);
        const targetId = getFederatedId(
            'https://provider.example.com/tmf',
            'urn:ngsi-ld:product-offering:1'
        );

        const req = {
            apiUrl: `/account/billingAccount?target=${targetId}&relatedParty.id=urn:organization:buyer`,
            user: {
                id: 'buyer-user',
                userId: 'individual-buyer',
                partyId: 'urn:organization:buyer'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(
            req,
            `http://local.example:1234/tmf-api/accountManagement/v4/billingAccount?target=${targetId}&relatedParty.id=urn:organization:buyer`
        );

        expect(resolved).toBe(
            'https://provider.example.com/tmf/tmf-api/accountManagement/v4/billingAccount?relatedParty.id=urn%3Aorganization%3Abuyer-in-provider'
        );
        expect(partyClient.getOrganizationsByQueryInApi).toHaveBeenCalledWith(
            'https://provider.example.com/tmf',
            'externalReference.name=VAT-BUYER'
        );
        expect(partyClient.getOrganizationsByQueryInApi).not.toHaveBeenCalledWith(
            'https://buyer-own.example.com/tmf/',
            'externalReference.name=VAT-BUYER'
        );
    });

    it('should keep party API local even when target query param is federated', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization')
        };
        const federation = getFederation(partyClient);
        const targetId = getFederatedId(
            'https://seller.example.com/tmf',
            'urn:ngsi-ld:billing-account:1'
        );

        const req = {
            apiUrl: `/party/organization?target=${targetId}`,
            user: {
                id: 'buyer-user',
                userId: 'individual-buyer',
                partyId: 'urn:organization:buyer'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(req, req.apiUrl);

        expect(resolved).toBe('');
        expect(partyClient.getOrganization).not.toHaveBeenCalled();
    });

    it('should resolve party API from a federated ID in path', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization')
        };
        const federation = getFederation(partyClient);
        const federatedId = getFederatedId(
            'https://seller.example.com/tmf',
            'urn:ngsi-ld:organization:remote-seller'
        );

        const req = {
            apiUrl: `/party/organization/${federatedId}`,
            user: {
                id: 'buyer-user',
                userId: 'individual-buyer',
                partyId: 'urn:organization:buyer'
            }
        };

        const resolved = await federation.resolveTmforumApiUrl(req, req.apiUrl);

        expect(resolved).toBe('https://seller.example.com/tmf/party/organization/urn:ngsi-ld:organization:remote-seller');
        expect(partyClient.getOrganization).not.toHaveBeenCalled();
    });

    it('should route product order creation through acting organization endpoint without generic context', async function() {
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

        const resolved = await federation.resolveTmforumApiUrl(req, '/ordering/productOrder');

        expect(resolved).toBe('https://buyer.example.com/tmf/ordering/productOrder');
        expect(partyClient.getOrganization).toHaveBeenCalledWith('urn:organization:buyer');
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

    it('should resolve remote party id from local party id and reuse cache', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.returnValue(
                Promise.resolve({
                    body: {
                        id: 'urn:organization:local-seller',
                        partyCharacteristic: [
                            { name: 'tmforumEndpoint', value: 'https://seller.example.com/tmf/' }
                        ],
                        externalReference: [{
                            externalReferenceType: 'idm_id',
                            name: 'VAT-SELLER'
                        }]
                    }
                })
            ),
            getOrganizationsByQueryInApi: jasmine.createSpy('getOrganizationsByQueryInApi').and.returnValue(
                Promise.resolve({
                    body: [{
                        id: 'urn:organization:remote-seller'
                    }]
                })
            )
        };
        const federation = getFederation(partyClient);

        const remoteId1 = await federation.resolveRemotePartyIdByLocalPartyId('urn:organization:local-seller');
        const remoteId2 = await federation.resolveRemotePartyIdByLocalPartyId('urn:organization:local-seller');

        expect(remoteId1).toBe('urn:organization:remote-seller');
        expect(remoteId2).toBe('urn:organization:remote-seller');
        expect(partyClient.getOrganization.calls.count()).toBe(1);
        expect(partyClient.getOrganizationsByQueryInApi.calls.count()).toBe(1);
        expect(partyClient.getOrganizationsByQueryInApi).toHaveBeenCalledWith(
            'https://seller.example.com/tmf/',
            'externalReference.name=VAT-SELLER'
        );
    });

    it('should keep federated organization cache isolated by endpoint', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization'),
            getOrganizationsByQueryInApi: jasmine.createSpy('getOrganizationsByQueryInApi').and.callFake((endpoint) => {
                const remoteId = endpoint === 'https://provider-a.example.com/tmf'
                    ? 'urn:organization:remote-seller-a'
                    : 'urn:organization:remote-seller-b';

                return Promise.resolve({
                    body: [{
                        id: remoteId
                    }]
                });
            })
        };
        const federation = getFederation(partyClient);

        const resolvedA1 = await federation.resolveFederatedOrganizationParty(
            'https://provider-a.example.com/tmf',
            'urn:organization:local-seller',
            'VAT-SELLER'
        );
        const resolvedA2 = await federation.resolveFederatedOrganizationParty(
            'https://provider-a.example.com/tmf',
            'urn:organization:local-seller',
            'VAT-SELLER'
        );
        const resolvedB = await federation.resolveFederatedOrganizationParty(
            'https://provider-b.example.com/tmf',
            'urn:organization:local-seller',
            'VAT-SELLER'
        );

        expect(resolvedA1.id).toBe('urn:organization:remote-seller-a');
        expect(resolvedA2.id).toBe('urn:organization:remote-seller-a');
        expect(resolvedB.id).toBe('urn:organization:remote-seller-b');
        expect(partyClient.getOrganization).not.toHaveBeenCalled();
        expect(partyClient.getOrganizationsByQueryInApi.calls.count()).toBe(2);
    });

    it('should fail resolving remote party id when local party has no idm_id external reference', async function() {
        const partyClient = {
            getOrganization: jasmine.createSpy('getOrganization').and.returnValue(
                Promise.resolve({
                    body: {
                        id: 'urn:organization:local-seller',
                        partyCharacteristic: [
                            { name: 'tmforumEndpoint', value: 'https://seller.example.com/tmf/' }
                        ],
                        externalReference: []
                    }
                })
            )
        };
        const federation = getFederation(partyClient);

        try {
            await federation.resolveRemotePartyIdByLocalPartyId('urn:organization:local-seller');
            fail('Expected remote party resolution to fail without idm_id external reference');
        } catch (err) {
            expect(err).toEqual({
                status: 422,
                message: 'Missing idm_id external reference for local organization party urn:organization:local-seller'
            });
        }
    });

});
