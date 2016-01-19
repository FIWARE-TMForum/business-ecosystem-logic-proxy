var proxyquire =  require('proxyquire'),
    testUtils = require('../../utils');

describe('Inventory API', function() {

    var getInventoryAPI = function() {
        return proxyquire('../../../controllers/tmf-apis/inventory', {
            './../../lib/logger': testUtils.emptyLogger
        }).inventory;
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////// NOT ALLOWED ////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var testNotAllowedMethod = function(method, done) {
        var inventory = getInventoryAPI();

        var req = {
            method: method
        };

        inventory.checkPermissions(req, function(err) {
            expect(err).not.toBe(null);
            expect(err.status).toBe(405);
            expect(err.message).toBe('The HTTP method ' + method + ' is not allowed in the accessed API');
            done();
        });
    };

    it('should give a 405 error with a POST request', function(done) {
        testNotAllowedMethod('POST', done);
    });

    it('should give a 405 error with a PUT request', function(done) {
        testNotAllowedMethod('PUT', done);
    });

    it('should give a 405 error with a PATCH request', function(done) {
        testNotAllowedMethod('PATCH', done);
    });

    it('should give a 405 error with a DELETE request', function(done) {
        testNotAllowedMethod('DELETE', done);
    });

    it('should redirect the inventory request', function(done){
        var inventory = getInventoryAPI();

        var req = {
            method: 'GET',
            user: {
                id: 'test'
            },
            query: {
                'relatedParty.id': 'test',
                'relatedParty.role': 'Customer'
            }
        };

        inventory.checkPermissions(req, function(err) {
            expect(err).toBe(null);
            done();
        });
    });

    var testGetRequestError = function(query, code, msg, done) {
        var inventory = getInventoryAPI();

        var req = {
            method: 'GET',
            user: {
                id: 'test'
            },
            query: query
        };

        inventory.checkPermissions(req, function(err) {
            expect(err).not.toBe(null);
            expect(err.status).toBe(code);
            expect(err.message).toBe(msg);
            done();
        });
    };

    it('should give a 400 error when the customer id is not provided', function(done) {
        var query = {
            'relatedParty.role': 'Customer'
        };
        var msg = 'Missing required param relatedParty.id';
        testGetRequestError(query, 400, msg, done);
    });

    it('should give a 400 error when the role is not provided', function(done) {
        var query = {
            'relatedParty.id': 'test'
        };
        var msg = 'Missing required param relatedParty.role';
        testGetRequestError(query, 400, msg, done);
    });

    it('should give a 403 error when the user is the owner of the product', function(done) {
        var query = {
            'relatedParty.id': 'notowner',
            'relatedParty.role': 'Customer'
        };
        var msg = 'Your are not authorized to retrieve the specified products';
        testGetRequestError(query, 403, msg, done);
    });

    it('should give a 403 error when not searching for the customer role', function(done) {
        var query = {
            'relatedParty.id': 'test',
            'relatedParty.role': 'Seller'
        };
        var msg = 'Your are not authorized to retrieve the specified products';
        testGetRequestError(query, 403, msg, done);
    });
});
