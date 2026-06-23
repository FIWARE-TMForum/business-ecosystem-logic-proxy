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

'use strict';

const proxyquire = require('proxyquire').noCallThru();

describe('Analytics Controller', () => {
    let axiosMock;
    let configMock;
    let controller;
    let loggerErrorSpy;
    let partyClientMock;

    const loadController = () => {
        return proxyquire('../../controllers/analytics', {
            axios: axiosMock,
            '../config': configMock,
            '../lib/utils': {
                hasRole: (user, roleName) => {
                    return user != null && Array.isArray(user.roles) && user.roles.some((role) => {
                        return role.name.toLowerCase() === roleName.toLowerCase()
                    })
                }
            },
            '../lib/party': {
                partyClient: partyClientMock
            },
            './../lib/logger': {
                logger: {
                    getLogger: () => ({ error: loggerErrorSpy })
                }
            }
        }).analytics();
    };

    const makeResponse = () => {
        const res = jasmine.createSpyObj('res', ['status', 'json']);
        res.status.and.returnValue(res);
        return res;
    };

    const makeUser = (roleNames) => {
        const roles = Array.isArray(roleNames) ? roleNames : [roleNames];

        return {
            userId: 'individual-user-1',
            partyId: 'urn:party:organization:1',
            roles: roles.map((roleName) => ({ name: roleName }))
        }
    };

    const mockSupersetSuccess = () => {
        axiosMock.request.and.returnValues(
            Promise.resolve({
                headers: {
                    'set-cookie': ['session=login-cookie; Path=/']
                },
                data: {
                    access_token: 'superset-access-token'
                }
            }),
            Promise.resolve({
                headers: {
                    'set-cookie': ['csrf=csrf-cookie; Path=/']
                },
                data: {
                    result: 'csrf-token'
                }
            }),
            Promise.resolve({
                headers: {},
                data: {
                    token: 'guest-token'
                }
            })
        );
    };

    beforeEach(() => {
        axiosMock = jasmine.createSpyObj('axios', ['request']);
        partyClientMock = jasmine.createSpyObj('partyClient', ['getOrganization']);
        loggerErrorSpy = jasmine.createSpy('logger.error');

        configMock = {
            roles: {
                admin: 'admin',
                customer: 'Buyer',
                seller: 'Seller',
                orgAdmin: 'orgAdmin'
            },
            analyticsDashboards: {
                businessInsightsNonLear: 'dashboard-business-non-lear',
                businessInsightsLear: 'dashboard-business-lear',
                usageMonitor: 'dashboard-usage'
            },
            analyticsSuperset: {
                url: 'https://superset.example.com/',
                username: 'svc-user',
                password: 'svc-password',
                provider: 'db',
                rls: {
                    businessInsightsNonLear: [
                        {
                            datasets: [75, 81],
                            clauseTemplate: "vat = '{{vat}}'"
                        }
                    ],
                    businessInsightsLear: [
                        {
                            datasets: [110, 108],
                            clauseTemplate: "vat = '{{vat}}'"
                        }
                    ],
                    usageMonitor: [
                        {
                            datasets: [115],
                            clauseTemplate: "vat = '{{vat}}'"
                        }
                    ]
                }
            }
        };

        partyClientMock.getOrganization.and.returnValue(Promise.resolve({
            body: {
                externalReference: [
                    {
                        externalReferenceType: 'idm_id',
                        name: 'VATDE-350750734'
                    }
                ]
            }
        }));

        controller = loadController();
    });

    it('returns 400 when the body is invalid', (done) => {
        const req = {
            body: '{invalid-json',
            user: makeUser(configMock.roles.customer)
        };
        const res = makeResponse();

        controller.getGuestToken(req, res).then(() => {
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid body' });
            expect(axiosMock.request).not.toHaveBeenCalled();
            done();
        });
    });

    it('returns 400 when the tab is invalid', (done) => {
        const req = {
            body: JSON.stringify({
                tab: 'unknown'
            }),
            user: makeUser(configMock.roles.customer)
        };
        const res = makeResponse();

        controller.getGuestToken(req, res).then(() => {
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'A valid tab is required' });
            expect(axiosMock.request).not.toHaveBeenCalled();
            done();
        });
    });

    it('returns 403 when a non-admin requests Usage Monitor', (done) => {
        const req = {
            body: JSON.stringify({
                tab: 'usageMonitor'
            }),
            user: makeUser(configMock.roles.customer)
        };
        const res = makeResponse();

        controller.getGuestToken(req, res).then(() => {
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'You are not authorized to access Usage Monitor' });
            expect(axiosMock.request).not.toHaveBeenCalled();
            done();
        });
    });

    it('selects Business Insights non-LEAR when the user is not orgAdmin', (done) => {
        const req = {
            body: JSON.stringify({
                tab: 'businessInsights'
            }),
            user: makeUser(configMock.roles.customer)
        };
        const res = makeResponse();

        mockSupersetSuccess();

        controller.getGuestToken(req, res).then(() => {
            expect(axiosMock.request.calls.count()).toBe(3);
            expect(partyClientMock.getOrganization).toHaveBeenCalledWith('urn:party:organization:1');
            expect(axiosMock.request.calls.argsFor(0)[0]).toEqual({
                method: 'POST',
                url: 'https://superset.example.com/api/v1/security/login',
                data: {
                    username: 'svc-user',
                    password: 'svc-password',
                    provider: 'db'
                },
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            expect(axiosMock.request.calls.argsFor(1)[0]).toEqual({
                method: 'GET',
                url: 'https://superset.example.com/api/v1/security/csrf_token/',
                data: null,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer superset-access-token',
                    Cookie: 'session=login-cookie'
                }
            });
            expect(axiosMock.request.calls.argsFor(2)[0]).toEqual({
                method: 'POST',
                url: 'https://superset.example.com/api/v1/security/guest_token/',
                data: {
                    user: {
                        username: 'embedded.user'
                    },
                    resources: [
                        {
                            type: 'dashboard',
                            id: 'dashboard-business-non-lear'
                        }
                    ],
                    rls: [
                        {
                            dataset: 75,
                            clause: "vat = 'VATDE-350750734'"
                        },
                        {
                            dataset: 81,
                            clause: "vat = 'VATDE-350750734'"
                        }
                    ]
                },
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer superset-access-token',
                    'X-CSRFToken': 'csrf-token',
                    Referer: 'https://superset.example.com',
                    Cookie: 'session=login-cookie; csrf=csrf-cookie'
                }
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                dashboardId: 'dashboard-business-non-lear',
                token: 'guest-token'
            });
            done();
        });
    });

    it('selects Business Insights LEAR when the user is orgAdmin', (done) => {
        const req = {
            body: JSON.stringify({
                tab: 'businessInsights'
            }),
            user: makeUser([configMock.roles.customer, configMock.roles.orgAdmin])
        };
        const res = makeResponse();

        mockSupersetSuccess();

        controller.getGuestToken(req, res).then(() => {
            expect(axiosMock.request.calls.argsFor(2)[0].data.resources).toEqual([
                {
                    type: 'dashboard',
                    id: 'dashboard-business-lear'
                }
            ]);
            expect(axiosMock.request.calls.argsFor(2)[0].data.rls).toEqual([
                {
                    dataset: 110,
                    clause: "vat = 'VATDE-350750734'"
                },
                {
                    dataset: 108,
                    clause: "vat = 'VATDE-350750734'"
                }
            ]);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                dashboardId: 'dashboard-business-lear',
                token: 'guest-token'
            });
            done();
        });
    });

    it('selects Usage Monitor when the user is admin', (done) => {
        const req = {
            body: JSON.stringify({
                tab: 'usageMonitor'
            }),
            user: makeUser(configMock.roles.admin)
        };
        const res = makeResponse();

        mockSupersetSuccess();

        controller.getGuestToken(req, res).then(() => {
            expect(axiosMock.request.calls.argsFor(2)[0].data.resources).toEqual([
                {
                    type: 'dashboard',
                    id: 'dashboard-usage'
                }
            ]);
            expect(axiosMock.request.calls.argsFor(2)[0].data.rls).toEqual([
                {
                    dataset: 115,
                    clause: "vat = 'VATDE-350750734'"
                }
            ]);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                dashboardId: 'dashboard-usage',
                token: 'guest-token'
            });
            done();
        });
    });

    it('returns 403 when there is no selected organization for dynamic RLS', (done) => {
        const user = makeUser(configMock.roles.seller);
        delete user.userId;

        const req = {
            body: JSON.stringify({
                tab: 'businessInsights'
            }),
            user: user
        };
        const res = makeResponse();

        controller.getGuestToken(req, res).then(() => {
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'An organization must be selected to access analytics dashboards' });
            expect(partyClientMock.getOrganization).not.toHaveBeenCalled();
            expect(axiosMock.request).not.toHaveBeenCalled();
            done();
        });
    });
});
