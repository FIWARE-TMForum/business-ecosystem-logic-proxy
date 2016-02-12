var proxyquire =  require('proxyquire'),
    testUtils = require('../../utils');

describe('Inventory API', function() {

    var getInventoryAPI = function(tmfUtils) {
        return proxyquire('../../../controllers/tmf-apis/inventory', {
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/tmfUtils': tmfUtils
        }).inventory;
    };

    describe('Check Permissions', function() {


        //////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////// NOT ALLOWED ////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        var testNotAllowedMethod = function (method, done) {
            var inventory = getInventoryAPI({});

            var req = {
                method: method
            };

            inventory.checkPermissions(req, function (err) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(405);
                expect(err.message).toBe('The HTTP method ' + method + ' is not allowed in the accessed API');
                done();
            });
        };

        it('should give a 405 error with a POST request', function (done) {
            testNotAllowedMethod('POST', done);
        });

        it('should give a 405 error with a PUT request', function (done) {
            testNotAllowedMethod('PUT', done);
        });

        it('should give a 405 error with a DELETE request', function (done) {
            testNotAllowedMethod('DELETE', done);
        });


        //////////////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////// RETRIEVAL /////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        it('should call callback with error when user is not logged in', function (done) {

            var errorStatus = 401;
            var errorMessage = 'You need to be authenticated to create/update/delete resources';

            var tmfUtils = {
                validateLoggedIn: function (req, callback) {
                    callback({
                        status: errorStatus,
                        message: errorMessage
                    });
                }
            };

            var inventoryApi = getInventoryAPI(tmfUtils);

            // Call the method
            var req = {
                method: 'GET'
            };

            inventoryApi.checkPermissions(req, function (err) {

                expect(err).not.toBe(null);
                expect(err.status).toBe(errorStatus);
                expect(err.message).toBe(errorMessage);

                done();
            });
        });

        var testRetrieval = function (filterRelatedPartyFields, expectedErr, done) {

            var ensureRelatedPartyIncludedCalled = false;

            var tmfUtils = {

                validateLoggedIn: function (req, callback) {
                    callback(null);
                },

                filterRelatedPartyFields: filterRelatedPartyFields,

                ensureRelatedPartyIncluded: function(req, callback) {
                    ensureRelatedPartyIncludedCalled = true;
                    callback(null);
                }
            };

            var req = {
                method: 'GET',
                path: '/example/api/path/product'
            };

            var inventoryApi = getInventoryAPI(tmfUtils);

            inventoryApi.checkPermissions(req, function (err) {
                expect(ensureRelatedPartyIncludedCalled).toBe(true);
                expect(err).toEqual(expectedErr);
                done();
            });

        };

        it('should call callback with error when retrieving list of products and filter related party fields fails', function (done) {

            var error = {
                status: 401,
                message: 'Invalid filters'
            };

            var filterRelatedPartyFields = function (req, callback) {
                callback(error);
            };

            testRetrieval(filterRelatedPartyFields, error, done);

        });

        it('should call callback without errors when user is allowed to retrieve the list of products', function (done) {

            var filterRelatedPartyFields = function (req, callback) {
                callback();
            };

            testRetrieval(filterRelatedPartyFields, null, done);

        });

        it('should call callback without error when retrieving a single product', function (done) {

            var ensureRelatedPartyIncludedCalled = false;

            var tmfUtils = {
                validateLoggedIn: function (req, callback) {
                    callback(null);
                },

                ensureRelatedPartyIncluded: function(req, callback) {
                    ensureRelatedPartyIncludedCalled = true;
                    callback(null);
                }
            };

            var req = {
                method: 'GET',
                path: '/example/api/path/product/7'
            };

            var inventoryApi = getInventoryAPI(tmfUtils);

            inventoryApi.checkPermissions(req, function (err) {
                expect(ensureRelatedPartyIncludedCalled).toBe(true);
                expect(err).toBe(null);
                done();
            });

        });
    });

    describe('Execute Post Validation', function() {

        var testCorrectPostValidation = function (req, done) {
            var inventory = getInventoryAPI({});

            inventory.executePostValidation(req, function (err, resp) {
                expect(err).toBe(null);
                expect(resp).toEqual();
                done();
            });
        };

        it('should redirect the request after validating permissions of retrieving a single product', function (done) {
            testCorrectPostValidation({
                method: 'GET',
                path: 'DSProductCatalog/api/productManagement/product/10',
                user: {
                    id: 'test'
                },
                headers: {},
                body: JSON.stringify({
                    relatedParty: [{
                        id: 'test',
                        role: 'Customer'
                    }]
                })
            }, done);
        });

        it('should give a 403 error when the user is not the customer who acquired the product', function (done) {
            var inventory = getInventoryAPI({});

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

            inventory.executePostValidation(req, function (err) {
                expect(err).toEqual({
                    'status': 403,
                    'message': 'You are not authorized to retrieve the specified offering from the inventory'
                });
                done();
            });
        });

        it('should filter non-owned products when retrieving list of products', function(done) {

            var tmfUtils = jasmine.createSpyObj('tmfUtils', ['updateBody']);
            var inventory = getInventoryAPI(tmfUtils);

            var validProduct = {
                relatedParty: [{
                    id: 'test',
                    role: 'customEr'
                }]
            };

            var req = {
                method: 'GET',
                path: 'DSProductCatalog/api/productManagement/product',
                user: {
                    id: 'test'
                },
                body: JSON.stringify([{
                    relatedParty: [{
                        id: 'owner',
                        role: 'Customer'
                    }]
                },{
                    relatedParty: [{
                        id: 'test',
                        role: 'customEr'
                    }]
                },{
                    relatedParty: [{
                        id: 'test',
                        role: 'Seller'
                    }]
                }])
            };

            inventory.executePostValidation(req, function(err) {
                expect(err).toBe(null);
                expect(tmfUtils.updateBody).toHaveBeenCalledWith(req, [validProduct]);
                done();
            });
        });
    });
});
