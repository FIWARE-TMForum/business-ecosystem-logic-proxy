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

const proxyquire = require('proxyquire').noCallThru();

describe('Compliance controller', function() {
    const getController = function(requestProductOfferingCertificate) {
        return proxyquire('../../controllers/compliance', {
            './../lib/compliance': {
                complianceClient: {
                    requestProductOfferingCertificate: requestProductOfferingCertificate
                }
            },
            './../lib/logger': {
                logger: {
                    getLogger: function() {
                        return {
                            info: function() {},
                            debug: function() {},
                            warn: function() {},
                            error: function() {}
                        };
                    }
                }
            }
        }).compliance;
    };

    const getResponse = function() {
        const res = {
            status: jasmine.createSpy('status'),
            json: jasmine.createSpy('json')
        };

        res.status.and.callFake(function() {
            return res;
        });

        return res;
    };

    it('should return 401 when credentials are missing', async function() {
        const controller = getController(function() {
            return Promise.resolve();
        });

        const req = {
            body: '{}'
        };
        const res = getResponse();

        await controller.requestCertificate(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Missing credentials' });
    });

    it('should return 400 when body is invalid', async function() {
        const controller = getController(function() {
            return Promise.resolve();
        });

        const req = {
            user: {
                accessToken: 'test-token'
            },
            body: '{"invalid-json"'
        };
        const res = getResponse();

        await controller.requestCertificate(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid body' });
    });

    it('should request certificate and return service response', async function() {
        const requestSpy = jasmine.createSpy('requestProductOfferingCertificate').and.returnValue(
            Promise.resolve({
                status: 201,
                body: {
                    certificateId: 'cert-1'
                }
            })
        );
        const controller = getController(requestSpy);

        const productSpecification = {
            id: 'prod-1'
        };
        const req = {
            user: {
                accessToken: 'test-token'
            },
            body: JSON.stringify(productSpecification)
        };
        const res = getResponse();

        await controller.requestCertificate(req, res);

        expect(requestSpy).toHaveBeenCalledWith(productSpecification, 'test-token');
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ certificateId: 'cert-1' });
    });

    it('should map service errors to API response', async function() {
        const controller = getController(function() {
            return Promise.reject({
                status: 422,
                body: {
                    error: 'Invalid compliance request'
                },
                message: 'Invalid compliance request'
            });
        });

        const req = {
            user: {
                accessToken: 'test-token'
            },
            body: '{"id":"prod-1"}'
        };
        const res = getResponse();

        await controller.requestCertificate(req, res);

        expect(res.status).toHaveBeenCalledWith(422);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid compliance request' });
    });
});
