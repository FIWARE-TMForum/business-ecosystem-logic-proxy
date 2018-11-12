/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
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

var proxyquire =  require('proxyquire'),
    testUtils = require('../../utils');


describe('Charging API', function () {

    var getChargingAPI = function() {
        return proxyquire('../../../controllers/tmf-apis/charging', {
            './../../lib/logger': testUtils.emptyLogger
        }).charging;
    };

    it('should call callback without errors when URL is allowed', function(done) {
        var chargingApi = getChargingAPI();

        var req = {
            method: 'GET',
            apiUrl: 'api/orderManagement/orders/accept'
        };

        chargingApi.checkPermissions(req, function(err) {
            expect(err).toBe(null);
            done();
        });
    });

    it('should call callback with errors when URL is not allowed', function(done) {
        var chargingApi = getChargingAPI();

        var req = {
            method: 'GET',
            apiUrl: 'api/orderManagement/orders/refund'
        };

        chargingApi.checkPermissions(req, function(err) {

            expect(err).toEqual({
                status: 403,
                message: 'This API is private'
            });

            done();
        });
    });

});