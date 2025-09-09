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

describe('Simulator Controller', () => {

    const utils = {
        getAPIURL: function(ssl, host, port, path) {
            return `http://${host}:${port}${path}`;
        }
    };

    const config = {
        billingEngineUrl: 'http://billing.example.com',
        endpoints: {
            account: {
                appSsl: false,
                host: 'account.example.com',
                port: 8080,
                apiPath: '/api/account'
            },
            catalog: {
                appSsl: false,
                host: 'catalog.example.com',
                port: 8081,
                apiPath: '/api/catalog'
            }
        }
    };

    const getSimulatorInstance = function(axios) {
        return proxyquire('../../controllers/simulator', {
            'axios': axios,
            './../config': config,
            './../lib/utils': utils,
            './../lib/logger': {
                logger: {
                    getLogger: () => ({ error: jasmine.createSpy('error') })
                }
            }
        }).simulator();
    };

    describe('checkBillAcc', () => {

        it('should handle valid billing account with matching user', (done) => {
            const mockBillingAccounts = [{
                id: 'billAcc123',
                relatedParty: [
                    { id: '::individual' }
                ],
                contact: [{
                    contactMedium: [{
                        preferred: true,
                        mediumType: 'PostalAddress'
                    }]
                }]
            }];

            const requestBody = {
                productOrder: {
                    productOrderItem: [{
                        productOffering: {
                            id: 'offering123'
                        },
                        billingAccount: {
                            id: 'billAcc123'
                        }
                    }]
                }
            };

            const request = {
                method: 'POST',
                body: JSON.stringify(requestBody),
                user: { partyId: '::individual' }
            };

            const response = jasmine.createSpyObj('res', ['status', 'send']);
            response.status.and.returnValue(response);

            const axios = jasmine.createSpy('axios');
            axios.get = jasmine.createSpy('get').and.returnValue(
                Promise.resolve({ data: mockBillingAccounts })
            );

            axios.and.callFake((config) => {
                if (config.url.includes('/productOffering/')) {
                    return Promise.resolve({
                        data: { productSpecification: { id: 'spec123' } }
                    });
                }
                if (config.url.includes('/productSpecification/')) {
                    return Promise.resolve({
                        data: { relatedParty: [{ id: 'seller123', role: 'owner' }] }
                    });
                }
                if (config.url.includes('/charging/api/orderManagement/orders/preview/')) {
                    return Promise.resolve({
                        status: 200,
                        data: { price: '10.00' }
                    });
                }
                return Promise.reject(new Error('Unknown URL'));
            });

            const resPromise = new Promise((resolve) => {
                response.send.and.callFake(() => resolve());
            });

            const instance = getSimulatorInstance(axios);
            instance.simulate(request, response);

            resPromise.then(() => {
                expect(axios.get).toHaveBeenCalledWith('http://account.example.com:8080/api/account/billingAccount?relatedParty.id=::individual');
                expect(response.status).toHaveBeenCalledWith(200);
                done();
            });
        });

        it('should return error when billing account not found', (done) => {
            const requestBody = {
                productOrder: {
                    productOrderItem: [{
                        productOffering: {
                            id: 'offering123'
                        }
                    }],
                    billingAccount: {
                    id: 'nonexistent'
                    }
                }
            };

            const request = {
                method: 'POST',
                body: JSON.stringify(requestBody),
                user: { partyId: '::individual' }
            };

            const response = jasmine.createSpyObj('res', ['status', 'send']);
            response.status.and.returnValue(response);

            const axios = jasmine.createSpy('axios');
            axios.get = jasmine.createSpy('get').and.returnValue(
                Promise.reject(new Error('Not found'))
            );

            const resPromise = new Promise((resolve) => {
                response.send.and.callFake(() => resolve());
            });

            const instance = getSimulatorInstance(axios);
            instance.simulate(request, response);

            resPromise.then(() => {
                expect(response.status).toHaveBeenCalledWith(400);
                expect(response.send).toHaveBeenCalledWith('Invalid billing account id');
                done();
            });
        });

        it('should return error when user not in billing account related parties', (done) => {
            const mockBillingAccount = {
                id: 'billAcc123',
                relatedParty: [
                    { id: 'user456' }
                ]
            };

            const requestBody = {
                productOrder: {
                    productOrderItem: [{
                        productOffering: {
                            id: 'offering123'
                        }
                    }],
                    billingAccount: {
                        id: 'billAcc123'
                    }
                },
            };

            const request = {
                method: 'POST',
                body: JSON.stringify(requestBody),
                user: { partyId: '::individual' }
            };

            const response = jasmine.createSpyObj('res', ['status', 'send']);
            response.status.and.returnValue(response);

            const axios = jasmine.createSpy('axios');
            axios.get = jasmine.createSpy('get').and.returnValue(
                Promise.resolve({ data: mockBillingAccount })
            );

            const resPromise = new Promise((resolve) => {
                response.send.and.callFake(() => resolve());
            });

            const instance = getSimulatorInstance(axios);
            instance.simulate(request, response);

            resPromise.then(() => {
                expect(response.status).toHaveBeenCalledWith(400);
                expect(response.send).toHaveBeenCalledWith('Cannot find the specified billing account for this user');
                done();
            });
        });

        it('should find preferred billing account when no specific account provided', (done) => {
            const mockBillingAccounts = [
                {
                    id: 'billAcc1',
                    contact: [{
                        contactMedium: [{
                            preferred: false,
                            mediumType: 'Email'
                        }]
                    }]
                },
                {
                    id: 'billAcc2',
                    contact: [{
                        contactMedium: [{
                            preferred: true,
                            mediumType: 'PostalAddress'
                        }]
                    }]
                }
            ];

            const requestBody = {
                productOrder: {
                    productOrderItem: [{
                        productOffering: {
                            id: 'offering123'
                        }
                    }],
                    billingAccount: {}
                }
            };

            const request = {
                method: 'POST',
                body: JSON.stringify(requestBody),
                user: { partyId: '::individual' }
            };

            const response = jasmine.createSpyObj('res', ['status', 'send']);
            response.status.and.returnValue(response);

            const axios = jasmine.createSpy('axios');
            axios.get = jasmine.createSpy('get').and.returnValue(
                Promise.resolve({ data: mockBillingAccounts })
            );

            axios.and.callFake((config) => {
                if (config.url.includes('/productOffering/')) {
                    return Promise.resolve({
                        data: { productSpecification: { id: 'spec123' } }
                    });
                }
                if (config.url.includes('/productSpecification/')) {
                    return Promise.resolve({
                        data: { relatedParty: [{ id: 'seller123', role: 'owner' }] }
                    });
                }
                if (config.url.includes('/charging/api/orderManagement/orders/preview/')) {
                    return Promise.resolve({
                        status: 200,
                        data: { price: '10.00' }
                    });
                }
                return Promise.reject(new Error('Unknown URL'));
            });

            const resPromise = new Promise((resolve) => {
                response.send.and.callFake(() => resolve());
            });

            const instance = getSimulatorInstance(axios);
            instance.simulate(request, response);

            resPromise.then(() => {
                expect(axios.get).toHaveBeenCalledWith('http://account.example.com:8080/api/account/billingAccount?relatedParty.id=::individual');
                expect(response.status).toHaveBeenCalledWith(200);
                done();
            });
        });

        it('should not call checkBillAcc when user is organization', (done) => {
            const requestBody = {
                productOrder: {
                    productOrderItem: [{
                        productOffering: {
                            id: 'offering123'
                        }
                    }],
                    billingAccount: {
                        id: 'billAcc123'
                    }
                }
            };

            const request = {
                method: 'POST',
                body: JSON.stringify(requestBody),
                user: { partyId: 'org:123:organization' }
            };

            const response = jasmine.createSpyObj('res', ['status', 'send']);
            response.status.and.returnValue(response);

            const axios = jasmine.createSpy('axios');
            axios.get = jasmine.createSpy('get');

            axios.and.callFake((config) => {
                if (config.url.includes('/productOffering/')) {
                    return Promise.resolve({
                        data: { productSpecification: { id: 'spec123' } }
                    });
                }
                if (config.url.includes('/productSpecification/')) {
                    return Promise.resolve({
                        data: { relatedParty: [{ id: 'seller123', role: 'owner' }] }
                    });
                }
                if (config.url.includes('/charging/api/orderManagement/orders/preview/')) {
                    return Promise.resolve({
                        status: 200,
                        data: { price: '10.00' }
                    });
                }
                return Promise.reject(new Error('Unknown URL'));
            });

            const resPromise = new Promise((resolve) => {
                response.send.and.callFake(() => resolve());
            });

            const instance = getSimulatorInstance(axios);
            instance.simulate(request, response);

            resPromise.then(() => {
                expect(axios.get).not.toHaveBeenCalledWith(jasmine.stringMatching(/billingAccount/));
                expect(response.status).toHaveBeenCalledWith(200);
                done();
            });
        });
    });
});