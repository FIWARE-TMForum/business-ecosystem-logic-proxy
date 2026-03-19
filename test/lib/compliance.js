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

describe('Compliance client', function() {
    const config = testUtils.getDefaultConfig();
    config.complianceServerUrl = 'https://dome-certification.dome-marketplace.eu';

    const getComplianceClient = function(axiosMock, partyMock, customConfig) {
        return proxyquire('../../lib/compliance', {
            '../config': customConfig || config,
            './party': {
                partyClient: partyMock
            },
            axios: axiosMock
        }).complianceClient;
    };

    const getValidProductSpecification = function() {
        return {
            id: 'PROD-2024-001',
            name: 'Payment Gateway API',
            version: '2.1',
            relatedParty: [
                {
                    id: 'urn:ngsi-ld:organization:1',
                    role: config.roles.seller
                }
            ],
            productSpecCharacteristic: [
                {
                    id: 'char-1',
                    name: 'Compliance:SelfAtt',
                    productSpecCharacteristicValue: [
                        {
                            isDefault: true,
                            value: 'https://dome-marketplace-dev.org/charging/media/assets/VATES-B87798617/f74520aa-ea60-4ec1-ae0c-47f772c7535c_tender_prov.pdf'
                        }
                    ]
                },
                {
                    id: 'char-2',
                    name: 'Compliance:EU Cloud CoC',
                    productSpecCharacteristicValue: [
                        {
                            isDefault: true,
                            value: 'https://dome-marketplace-dev.org/charging/media/assets/VATES-B87798617/6ef4860f-f18a-4c9f-a805-0bd25b2a8311_attestation.pdf'
                        }
                    ]
                },
                {
                    id: 'char-3',
                    name: 'Compliance:ISO 27000',
                    productSpecCharacteristicValue: [
                        {
                            isDefault: true,
                            value: 'https://dome-marketplace-dev.org/charging/media/assets/VATES-B87798617/c17e2c6d-b8f3-4e4f-859a-b689fd7b5447_tender.pdf'
                        }
                    ]
                },
                {
                    id: 'char-4',
                    name: 'Compliance:VC',
                    productSpecCharacteristicValue: [
                        {
                            isDefault: true,
                            value: 'https://dome-marketplace-dev.org/charging/media/assets/VATES-B87798617/credential.json'
                        }
                    ]
                }
            ]
        };
    };

    const getValidSellerOrganization = function() {
        return {
            tradingName: 'TechCorp Solutions',
            contactMedium: [
                {
                    mediumType: 'PostalAddress',
                    characteristic: {
                        street1: 'Calle Mayor 123',
                        postCode: '28001',
                        city: 'Madrid',
                        country: 'Spain'
                    }
                },
                {
                    mediumType: 'Email',
                    characteristic: {
                        emailAddress: 'compliance@techcorp.com'
                    }
                }
            ],
            partyCharacteristic: [
                {
                    name: 'website',
                    value: 'https://www.techcorp.com'
                },
                {
                    name: 'country',
                    value: 'Spain'
                }
            ],
            externalReference: [
                {
                    externalReferenceType: 'idm_id',
                    name: 'ESA12345678'
                }
            ]
        };
    };

    it('should send multipart compliance request using seller party data', function(done) {
        let calledOptions;
        const requestedFileUrls = [];

        const axiosMock = {
            request: function(options) {
                calledOptions = options;

                return Promise.resolve({
                    status: 201,
                    headers: {
                        'content-type': 'application/json'
                    },
                    data: {
                        status: 'accepted'
                    }
                });
            },
            get: function(url) {
                requestedFileUrls.push(url);
                return Promise.resolve({
                    headers: {
                        'content-type': 'application/pdf'
                    },
                    data: Buffer.from('fake-pdf-content')
                });
            }
        };

        const partyMock = {
            getOrganization: function() {
                return Promise.resolve({
                    status: 200,
                    body: getValidSellerOrganization()
                });
            }
        };

        const complianceClient = getComplianceClient(axiosMock, partyMock);
        const productSpecification = getValidProductSpecification();

        complianceClient.requestProductOfferingCertificate(productSpecification, 'access-token').then((response) => {
            expect(response).toEqual({
                status: 201,
                headers: {
                    'content-type': 'application/json'
                },
                body: {
                    status: 'accepted'
                }
            });

            expect(calledOptions.url).toBe(
                'https://dome-certification.dome-marketplace.eu/api/v1/productoffering/certificate'
            );
            expect(calledOptions.method).toBe('POST');
            expect(calledOptions.headers.Authorization).toBe('Bearer access-token');

            const multipartBody = calledOptions.data.getBuffer().toString('utf8');
            expect(multipartBody).toContain('name="product_specification_id"');
            expect(multipartBody).toContain('PROD-2024-001');
            expect(multipartBody).toContain('name="service_name"');
            expect(multipartBody).toContain('Payment Gateway API');
            expect(multipartBody).toContain('name="organization_name"');
            expect(multipartBody).toContain('TechCorp Solutions');
            expect(multipartBody).toContain('name="organization_address"');
            expect(multipartBody).toContain('Calle Mayor 123, 28001, Madrid, Spain');
            expect(multipartBody).toContain('name="organization_country"');
            expect(multipartBody).toContain('ES');
            expect(multipartBody).toContain('name="organization_email"');
            expect(multipartBody).toContain('compliance@techcorp.com');
            expect(multipartBody).toContain('name="organization_url"');
            expect(multipartBody).toContain('https://www.techcorp.com');
            expect(multipartBody).toContain('name="organization_vat_id"');
            expect(multipartBody).toContain('ESA12345678');
            expect(multipartBody).toContain('name="requested_compliance_level"');
            expect(multipartBody).toContain('Baseline');
            expect(multipartBody).toContain('filename="f74520aa-ea60-4ec1-ae0c-47f772c7535c_tender_prov.pdf"');
            expect(multipartBody).toContain('filename="6ef4860f-f18a-4c9f-a805-0bd25b2a8311_attestation.pdf"');
            expect(multipartBody).toContain('filename="c17e2c6d-b8f3-4e4f-859a-b689fd7b5447_tender.pdf"');
            expect(requestedFileUrls.length).toBe(3);
            expect(requestedFileUrls).not.toContain(
                'https://dome-marketplace-dev.org/charging/media/assets/VATES-B87798617/credential.json'
            );

            done();
        }).catch(done.fail);
    });

    it('should reject when seller related party is missing', function(done) {
        const axiosMock = {
            request: function() {
                return Promise.reject(new Error('axios.request should not be called in this test'));
            },
            get: function() {
                return Promise.reject(new Error('axios.get should not be called in this test'));
            }
        };

        const partyMock = {
            getOrganization: function() {
                return Promise.reject(new Error('party API should not be called in this test'));
            }
        };

        const complianceClient = getComplianceClient(axiosMock, partyMock);
        const productSpecification = getValidProductSpecification();
        productSpecification.relatedParty[0].role = 'Buyer';

        complianceClient.requestProductOfferingCertificate(productSpecification).then(() => {
            done.fail('Expected requestProductOfferingCertificate to fail');
        }).catch((err) => {
            expect(err).toEqual({
                status: 400,
                message: `Missing related party with role ${config.roles.seller}`,
                body: null
            });
            done();
        });
    });

    it('should reject when compliance server returns an error', function(done) {
        const axiosMock = {
            request: function() {
                return Promise.reject({
                    response: {
                        status: 422,
                        data: {
                            error: 'Invalid compliance request'
                        }
                    }
                });
            },
            get: function() {
                return Promise.resolve({
                    headers: {
                        'content-type': 'application/pdf'
                    },
                    data: Buffer.from('fake-pdf-content')
                });
            }
        };

        const partyMock = {
            getOrganization: function() {
                return Promise.resolve({
                    status: 200,
                    body: getValidSellerOrganization()
                });
            }
        };

        const complianceClient = getComplianceClient(axiosMock, partyMock);

        complianceClient.requestProductOfferingCertificate(getValidProductSpecification()).then(() => {
            done.fail('Expected requestProductOfferingCertificate to fail');
        }).catch((err) => {
            expect(err).toEqual({
                status: 422,
                message: 'Invalid compliance request',
                body: {
                    error: 'Invalid compliance request'
                }
            });
            done();
        });
    });

    it('should reject when compliance URL is not configured', function(done) {
        const emptyConfig = testUtils.getDefaultConfig();
        emptyConfig.complianceServerUrl = '';

        const axiosMock = {
            request: function() {
                return Promise.reject(new Error('axios.request should not be called in this test'));
            },
            get: function() {
                return Promise.reject(new Error('axios.get should not be called in this test'));
            }
        };

        const partyMock = {
            getOrganization: function() {
                return Promise.resolve({
                    status: 200,
                    body: getValidSellerOrganization()
                });
            }
        };

        const complianceClient = getComplianceClient(axiosMock, partyMock, emptyConfig);

        complianceClient.requestProductOfferingCertificate(getValidProductSpecification()).then(() => {
            done.fail('Expected requestProductOfferingCertificate to fail');
        }).catch((err) => {
            expect(err).toEqual({
                status: 500,
                message: 'Compliance server URL is not configured',
                body: null
            });
            done();
        });
    });

    it('should reject when compliance file cannot be downloaded while generating form payload', function(done) {
        const axiosMock = {
            request: function() {
                return Promise.reject(new Error('axios.request should not be called in this test'));
            },
            get: function() {
                return Promise.reject({
                    response: {
                        status: 404,
                        data: {
                            error: 'File not found'
                        }
                    }
                });
            }
        };

        const partyMock = {
            getOrganization: function() {
                return Promise.resolve({
                    status: 200,
                    body: getValidSellerOrganization()
                });
            }
        };

        const complianceClient = getComplianceClient(axiosMock, partyMock);

        complianceClient.requestProductOfferingCertificate(getValidProductSpecification()).then(() => {
            done.fail('Expected requestProductOfferingCertificate to fail');
        }).catch((err) => {
            expect(err).toEqual({
                status: 404,
                message: 'File not found',
                body: {
                    error: 'File not found'
                }
            });
            done();
        });
    });
});
