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

    it('should redirect the inventory request when asking for a concrete product', function(done) {
        var inventory = getInventoryAPI();
        var req = {
            path: 'DSProductCatalog/api/productManagement/product/10',
            method: 'GET',
            user: {
                id: 'test'
            }
        };

        inventory.checkPermissions(req, function(err) {
            expect(err).toBe(null);
            done();
        });
    });

    it('should redirect the inventory request when asking for a set of products', function(done){
        var inventory = getInventoryAPI();

        var req = {
            path: 'DSProductCatalog/api/productManagement/product',
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
            path: 'DSProductCatalog/api/productManagement/product',
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

    var testCorrectPostValidation = function(req, done) {
        var inventory = getInventoryAPI();

        inventory.executePostValidation(req, function(err, resp) {
            expect(err).toBe(null);
            expect(resp).toEqual({
                extraHdrs: {}
            });
            done();
        });
    };

    it('should redirect the request if pot validating a collection request', function(done) {
        testCorrectPostValidation({
            method: 'GET',
            path: 'DSProductCatalog/api/productManagement/product'
        }, done)
    });

    it('should redirect the request after validating permissions of retrieving a single product', function(done) {
        testCorrectPostValidation({
            method: 'GET',
            path: 'DSProductCatalog/api/productManagement/product/10',
            user: {
                id: 'test'
            },
            body: JSON.stringify({
                relatedParty: [{
                    id: 'test',
                    role: 'Customer'
                }]
            })
        }, done)
    });

    it('should give a 403 error when the user is not the customer who acquired the product', function(done) {
        var inventory = getInventoryAPI();

        var req = {
            method: 'GET',
            path: 'DSProductCatalog/api/productManagement/product/10',
            user: {
                id: 'test'
            },
            body: JSON.stringify({
                relatedParty: [{
                    id: 'owner',
                    role: 'Customer'
                }]
            })
       };

        inventory.executePostValidation(req, function(err, resp) {
            expect(resp).toBe(undefined);
            expect(err).toEqual({
                'status': 403,
                'message': 'Your are not authorized to retrieve the specified product'
            });
            done();
        });
    });
});
