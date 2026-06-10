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

describe('Federation middleware', function() {
    let config;
    let federation;

    const getMiddleware = function() {
        return proxyquire('../../federation/middleware', {
            '../config': config,
            './lib/federation': {
                federation: federation
            },
            '../lib/logger': testUtils.emptyLogger
        }).middleware;
    };

    beforeEach(function() {
        config = testUtils.getDefaultConfig();
        federation = {
            setRequestFederationContextFromApiUrl: jasmine
                .createSpy('setRequestFederationContextFromApiUrl')
                .and.returnValue(Promise.resolve(null))
        };
    });

    it('should set federation context before TMForum pre-validation', function(done) {
        config.federationEnabled = true;

        federation.setRequestFederationContextFromApiUrl.and.callFake((req) => {
            req.federationContext = {
                tmforumEndpoint: 'https://seller.example.com/tmf'
            };
            return Promise.resolve(req.federationContext);
        });

        const middleware = getMiddleware();
        const req = {
            apiUrl: '/ordering/productOrder?target=federationRef::abc'
        };
        const res = jasmine.createSpyObj('res', ['status', 'json', 'end']);

        middleware.setRequestFederationContext(req, res, function() {
            expect(federation.setRequestFederationContextFromApiUrl).toHaveBeenCalledWith(req, req.apiUrl);
            expect(req.federationContext).toEqual({
                tmforumEndpoint: 'https://seller.example.com/tmf'
            });
            expect(res.status).not.toHaveBeenCalled();
            done();
        });
    });

    it('should skip federation context for non-TMForum APIs', function(done) {
        config.federationEnabled = true;

        const middleware = getMiddleware();
        const req = {
            apiUrl: '/quote/quote?target=federationRef::abc'
        };
        const res = jasmine.createSpyObj('res', ['status', 'json', 'end']);

        middleware.setRequestFederationContext(req, res, function() {
            expect(federation.setRequestFederationContextFromApiUrl).not.toHaveBeenCalled();
            expect(req.federationContext).toBeUndefined();
            expect(res.status).not.toHaveBeenCalled();
            done();
        });
    });

    it('should skip federation context when federation is disabled', function(done) {
        config.federationEnabled = false;

        const middleware = getMiddleware();
        const req = {
            apiUrl: '/ordering/productOrder?target=federationRef::abc'
        };
        const res = jasmine.createSpyObj('res', ['status', 'json', 'end']);

        middleware.setRequestFederationContext(req, res, function() {
            expect(federation.setRequestFederationContextFromApiUrl).not.toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
            done();
        });
    });
});
