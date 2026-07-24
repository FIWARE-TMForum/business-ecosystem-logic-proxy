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
            accessToken: 'dome-verifier-access-token',
            roles: roles.map((roleName) => ({ name: roleName }))
        }
    };

    const mockSupersetSuccess = () => {
        axiosMock.request.and.returnValue(Promise.resolve({
            headers: {},
            data: {
                token: 'guest-token'
            }
        }));
    };

    beforeEach(() => {
        axiosMock = jasmine.createSpyObj('axios', ['request']);
        loggerErrorSpy = jasmine.createSpy('logger.error');

        configMock = {
            roles: {
                admin: 'admin',
                customer: 'Buyer',
                seller: 'Seller',
                orgAdmin: 'orgAdmin'
            },
            analyticsEnabled: true,
            analyticsDashboards: {
                businessInsightsNonLear: 'dashboard-business-non-lear',
                businessInsightsLear: 'dashboard-business-lear',
                usageMonitor: 'dashboard-usage'
            },
            analyticsSuperset: {
                url: 'https://superset.example.com/',
                guestTokenPath: '/api/v1/dome/guest_token/'
            }
        };

        controller = loadController();
    });

    it('returns 403 when analytics is disabled', (done) => {
        configMock.analyticsEnabled = false;
        const req = {
            body: JSON.stringify({
                tab: 'businessInsights'
            }),
            user: makeUser(configMock.roles.customer)
        };
        const res = makeResponse();

        controller.getGuestToken(req, res).then(() => {
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Analytics is disabled' });
            expect(axiosMock.request).not.toHaveBeenCalled();
            done();
        });
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
            expect(axiosMock.request.calls.count()).toBe(1);
            expect(axiosMock.request.calls.argsFor(0)[0]).toEqual({
                method: 'POST',
                url: 'https://superset.example.com/api/v1/dome/guest_token/',
                data: {
                    dashboard: 'dashboard-business-non-lear'
                },
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer dome-verifier-access-token'
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
            expect(axiosMock.request.calls.count()).toBe(1);
            expect(axiosMock.request.calls.argsFor(0)[0].data).toEqual({
                dashboard: 'dashboard-business-lear'
            });
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
            expect(axiosMock.request.calls.count()).toBe(1);
            expect(axiosMock.request.calls.argsFor(0)[0].data).toEqual({
                dashboard: 'dashboard-usage'
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                dashboardId: 'dashboard-usage',
                token: 'guest-token'
            });
            done();
        });
    });

    it('uses the configured Superset guest-token path without requiring a leading slash', (done) => {
        configMock.analyticsSuperset.guestTokenPath = 'custom/dome/guest_token/'
        const req = {
            body: JSON.stringify({
                tab: 'businessInsights'
            }),
            user: makeUser(configMock.roles.seller)
        };
        const res = makeResponse();
        mockSupersetSuccess();

        controller.getGuestToken(req, res).then(() => {
            expect(axiosMock.request.calls.argsFor(0)[0].url).toBe('https://superset.example.com/custom/dome/guest_token/');
            expect(res.status).toHaveBeenCalledWith(200);
            done();
        });
    });
});
