var nock = require('nock'),
    proxyquire =  require('proxyquire'),
    testUtils = require('../../utils');


describe('Catalog API', function() {

    var config = testUtils.getDefaultConfig();

    var getCatalogApi = function(storeClient) {
        return proxyquire('../../../controllers/tmf-apis/catalog', {
            './../../config': config,
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/store': storeClient
        }).catalog;
    };


    //////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////// GET ////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    it('should call OK callback on GET requests', function(done) {

        var catalogApi = getCatalogApi({});

        var req = {
            method: 'GET',
            user: { roles: [] }
        };

        catalogApi.checkPermissions(req, function() {
            // Callback function. It's called without arguments...
            done();
        });
    });


    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// CREATE ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var testCreateBasic = function(user, body, roles, error, expectedStatus, expectedErr, done) {

        var catalogApi = getCatalogApi({});

        var req = {
            url: '/catalog/a/b',
            method: 'POST',
            body: body,
            user: {
                id: user, 
                roles: roles 
            }
        };

        catalogApi.checkPermissions(req, function(err) {

            if (!error) {
                expect(err).toBe(null);
            } else {
                expect(err.status).toBe(expectedStatus);
                expect(err.message).toBe(expectedErr);
            }

            done();
        });

    };

    it('should call error callback when creating resources with invalid JSON', function(done) {
        testCreateBasic('test', '{', [], true, 400, 'The resource is not a valid JSON document', done);
    });

    it('should call error callback when user is not a seller', function(done) {
        testCreateBasic('test', '{}', [], true, 403, 'You are not authorized to create resources', done);
    });

    it('should call error callback when the user is not the owner of the created resource', function(done) {
        var user = 'test';
        var resource = {
            relatedParty: [{ name: user, role: 'invalid role' }]
        };

        testCreateBasic(user, JSON.stringify(resource), [{ name: config.oauth2.roles.seller }], true, 403, 'The user making the request and the specified owner are not the same user', done);
    });

    it('should call error callback when the resource does not contains the relatedParty field', function(done) {
        testCreateBasic('test', JSON.stringify({ }), [{ name: config.oauth2.roles.seller }], true, 403, 'The user making the request and the specified owner are not the same user', done);
    });

    it('should call ok callback when the user is the owner of the created resource', function(done) {

        var user = 'test';
        var resource = {
            relatedParty: [{ id: user, role: 'OwNeR' }]
        };

        // Error parameters are not required when the resource can be created
        testCreateBasic(user, JSON.stringify(resource), [{ name: config.oauth2.roles.seller }], false, null, null, done);
    });

    it('should call ok callback when the user is admin', function(done) {
        var user = 'admin';
        var resource = {
            relatedParty: [{ id: 'test', role: 'OwNeR' }]
        };
        testCreateBasic(user, JSON.stringify(resource), [{ name: config.oauth2.roles.admin }], false, null, null, done);
    });

    var testCreateOffering = function(isOwner, productRequestFails, errorStatus, errorMsg, done) {

        var catalogApi = getCatalogApi({});

        // Basic properties
        var userName = 'test';
        var offeringPath = '/catalog/productOffering/1';
        var productPath = '/product/7';
        var protocol = config.appSsl ? 'https' : 'http';
        var serverUrl = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;

        // The mock server that will handle the request when the product is requested
        var statusOk = 200;
        var statusErr = 500;
        var statusCodeGetProduct = productRequestFails ? statusErr : statusOk;

        var role = isOwner ? 'Owner': 'Seller';
        var bodyOk = { relatedParty: [{id: userName, role: role}]};
        var bodyErr = 'Internal Server Error';
        var bodyGetProduct = productRequestFails ? bodyErr : bodyOk;

        var serverProduct = nock(serverUrl)
                .get(productPath)
                .reply(statusCodeGetProduct, bodyGetProduct);

        // Call the method
        var req = {
            // If the previous tests works, it can be deducted that PUT, PATCH and DELETE
            // requests are handled in the same way so here we do not need additional tests
            // for the different HTTP verbs.
            method: 'POST',
            url: offeringPath,
            user: {
                id: userName,
                roles: [{ name: config.oauth2.roles.seller }]
            },
            body: JSON.stringify({
                productSpecification: {
                    // the server will be avoided by the SW
                    // The catalog server will be used instead
                    href: config.appHost + ':' + config.endpoints.catalog.port + productPath
                }
            })
        };

        catalogApi.checkPermissions(req, function(err) {

            if (isOwner && !productRequestFails) {
                expect(err).toBe(null);
            } else {
                expect(err.status).toBe(errorStatus);
                expect(err.message).toBe(errorMsg);
            }

            done();
        });
    };

    it('should call OK callback when creating an offering with an owned product', function(done) {
        testCreateOffering(true, false, null, null, done);
    });


    it('should call error callback when creating an offering with a non owned product', function(done) {
        testCreateOffering(false, false, 403, 'The user making the request and the specified owner are not the same user', done);
    });

    it('should call error callback when creating an offering and the attached product cannot be checked', function(done) {
        // isOwner does not matter when productRequestFails is set to true
        testCreateOffering(false, true, 400, 'The product specification of the given product offering is not valid', done);
    });

    var testCreateProduct = function(isOwner, storeValidator, errorStatus, errorMsg, done) {

        // Store Client
        var storeClient = {
            storeClient: {
                validateProduct: storeValidator
            }
        };

        var catalogApi = getCatalogApi(storeClient);

        // Basic properties
        var userName = 'test';
        var offeringPath = '/catalog/productSpecification/1';
        var productPath = '/product/7';
        var protocol = config.appSsl ? 'https' : 'http';
        var serverUrl = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;
        var role = isOwner ? 'Owner': 'Seller';
        var body = { relatedParty: [{id: userName, role: role}]};

        // Call the method
        var req = {
            // If the previous tests works, it can be deducted that PUT, PATCH and DELETE
            // requests are handled in the same way so here we do not need additional tests
            // for the different HTTP verbs.
            method: 'POST',
            url: offeringPath,
            user: {
                id: userName,
                roles: [{ name: config.oauth2.roles.seller }]
            },
            body: JSON.stringify(body)
        };

        catalogApi.checkPermissions(req, function(err) {

            if (errorStatus == null && errorMsg == null) {
                expect(err).toBe(null);
            } else {
                expect(err.status).toBe(errorStatus);
                expect(err.message).toBe(errorMsg);

            }

            done();
        });
    };

    var storeValidatorOk = function(body, user, callback) {
        callback();
    };

    it('should call OK callback when creating an owned product', function(done) {
        testCreateProduct(true, storeValidatorOk, null, null, done);
    });

    it('should call error callback when creating a non owned product', function(done) {
        testCreateProduct(false, storeValidatorOk, 403, 'The user making the request and the specified owner are not the same user', done);
    });

    it('should call error callback when creating a product that cannot be checked by the store', function(done) {

        var storeErrorStatus = 400;
        var storeErrorMessage = 'Invalid product';

        var storeValidatorErr = function(body, user, callback) {
            callback({ status: storeErrorStatus, message: storeErrorMessage });
        };

        // Actual call
        // isOwner does not matter when productRequestFails is set to true
        testCreateProduct(false, storeValidatorErr, storeErrorStatus, storeErrorMessage, done);
    });


    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////// UPDATE & DELETE //////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var testUpdate = function(method, isOwner, requestFails, done) {

        var catalogApi = getCatalogApi({});

        var userName = 'test';
        var path = '/catalog/product/1';
        var protocol = config.appSsl ? 'https' : 'http';
        var url = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;
        var role = isOwner ? 'Owner': 'Seller';

        // statusCode depends on whether the request fails or not 
        var statusOk = 200;
        var statusErr = 500;
        var statusCode = requestFails ? statusErr : statusOk;
        
        // User information is send when the request does not fail
        var bodyOk = { relatedParty: [{id: userName, role: role}]};
        var bodyErr = 'Internal Server Error';
        var returnedBody = requestFails ? bodyErr : bodyOk;

        // The mock server that will handle the request
        var server = nock(url).get(path).reply(statusCode, returnedBody);

        // Call the method
        var req = {
            method: method,
            url: path,
            user: {
                id: userName,
                roles: []
            }
        };

        catalogApi.checkPermissions(req, function(err) {

            if (isOwner && !requestFails) {
                expect(err).toBe(null);
            } else if (requestFails) {
                expect(err.status).toBe(statusErr);
                expect(err.message).toBe(bodyErr);
            } else {
                expect(err.status).toBe(403);
                expect(err.message).toBe('The user making the request is not the owner of the accessed resource');
            }

            done();
        });
    };

    it('should call OK callback when user tries to update (PUT) a resource that owns', function(done) {
        testUpdate('PUT', true, false, done);
    });

    it('should call error callback when user tries to update (PUT) a resource that does not owns', function(done) {
        testUpdate('PUT', false, false, done);
    });

    it('should call error callback when user tries to update (PUT) a resource that cannot be checked', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('PUT', false, true, done);
    });

    it('should call OK callback when user tries to update (PATCH) a resource that owns', function(done) {
        testUpdate('PATCH', true, false, done);
    });

    it('should call error callback when user tries to update (PATCH) a resource that does not owns', function(done) {
        testUpdate('PATCH', false, false, done);
    });

    it('should call error callback when user tries to update (PATCH) a resource that cannot be checked', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('PATCH', false, true, done);
    });

    it('should call OK callback when user tries to delete a resource that owns', function(done) {
        testUpdate('DELETE', true, false, done);
    });

    it('should call error callback when user tries to delete a resource that does not owns', function(done) {
        testUpdate('DELETE', false, false, done);
    });

    it('should call error callback when user tries to delete a resource that cannot be checked', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('DELETE', false, true, done);
    });

    var testUpdateProductOffering = function(isOwner, productRequestFails, expectedErrorStatus, expectedErrorMsg, done) {

        var catalogApi = getCatalogApi({});

        // Basic properties
        var userName = 'test';
        var offeringPath = '/catalog/productOffering/1';
        var productPath = '/product/7';
        var protocol = config.appSsl ? 'https' : 'http';
        var serverUrl = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;
        
        // HTTP MOCK - OFFERING
        var bodyGetOffering = { 
            productSpecification: {
                // the server will be avoided by the SW
                // The catalog server will be used instead
                href: config.appHost + ':' + config.endpoints.catalog.port + productPath
            }
        };

        var serverOffering = nock(serverUrl).get(offeringPath).reply(200, bodyGetOffering);

        // HTTP MOCK - PRODUCT (THE ONE ATTACHED TO THE OFFERING)
        var statusOk = 200;
        var statusErr = 500;
        var statusCodeGetProduct = productRequestFails ? statusErr : statusOk;

        var role = isOwner ? 'Owner': 'Seller';
        var bodyOk = { relatedParty: [{id: userName, role: role}]};
        var bodyErr = 'Internal Server Error';
        var bodyGetProduct = productRequestFails ? bodyErr : bodyOk;

        var serverProduct = nock(serverUrl)
                .get(productPath)
                .reply(statusCodeGetProduct, bodyGetProduct);


        // Call the method
        var req = {
            // If the previous tests works, it can be deducted that PUT, PATCH and DELETE
            // requests are handled in the same way so here we do not need additional tests
            // for the different HTTP verbs.
            method: 'PUT',
            url: offeringPath,
            user: {
                id: userName,
                roles: []
            }
        };

        catalogApi.checkPermissions(req, function(err) {

            if (isOwner && !productRequestFails) {
                expect(err).toBe(null);
            } else {
                expect(err.status).toBe(expectedErrorStatus);
                expect(err.message).toBe(expectedErrorMsg);
            }

            done();
        });
    };

    it('should call OK callback when user tries to update an offering that owns', function(done) {
        testUpdateProductOffering(true, false, null, null, done);
    });

    it('should call error callback when user tries to update an offering that does not owns', function(done) {
        testUpdateProductOffering(false, false, 403, 'The user making the request is not the owner of the accessed resource', done);
    });

    it('should call error callback when user tries to update an offering and the attached product cannot be checked', function(done) {
        // isOwner does not matter when productRequestFails is set to true
        testUpdateProductOffering(false, true, 400, 'The product specification of the given product offering is not valid', done);
    });

});