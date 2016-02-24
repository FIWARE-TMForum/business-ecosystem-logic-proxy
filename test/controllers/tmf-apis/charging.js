
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