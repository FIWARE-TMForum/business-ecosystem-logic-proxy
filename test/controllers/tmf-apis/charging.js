
var proxyquire =  require('proxyquire'),
    testUtils = require('../../utils');


describe('Charging API', function () {

    var getChargingAPI = function() {
        return proxyquire('../../../controllers/tmf-apis/charging', {
            './../../lib/logger': testUtils.emptyLogger
        }).charging;
    };

    it('should redirect the request to the charging backend API', function(done) {
        var chargingApi = getChargingAPI();

        var req = {
            method: 'GET'
        };

        chargingApi.checkPermissions(req, function() {
            // Callback function. It's called without arguments...
            done();
        });
    });
});