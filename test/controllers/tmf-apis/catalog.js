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
    }

    
    it('should call OK callback when user is admin', function(done) {

        var catalogApi = getCatalogApi({});

        req = {
            user: {
                roles: [{
                    id: config.oauth2.roles.admin
                }]
            }
        }

        catalogApi.checkPermissions(req, function() {
            // Callback function. It's called without arguments...
            done();
        });
    });

    it('should call OK callback on GET requests', function(done) {

        var catalogApi = getCatalogApi({});

        var req = {
            method: 'GET',
            user: { roles: [] }
        }

        catalogApi.checkPermissions(req, function() {
            // Callback function. It's called without arguments...
            done();
        });
    });

    var testCreateErrorBasic = function(user, body, seller, expectedStatus, expectedErr, done) {

        var catalogApi = getCatalogApi({});

        var roles = seller === false ? [] : [{ id: config.oauth2.roles.seller }]

        var req = {
            url: '/catalog/a/b',
            method: 'POST',
            body: body,
            user: {
                id: user, 
                roles: roles 
            }
        }

        catalogApi.checkPermissions(req, null, function(status, errMsg) {
            expect(status).toBe(expectedStatus);
            expect(errMsg).toBe(expectedErr);
            done();
        });

    }

    it('should call error callback when creating resources with invalid JSON', function(done) {
        testCreateErrorBasic('test', '{', false, 400, 'The resource is not a valid JSON document', done);
    });

    it('should call error callback when user is not a seller', function(done) {
        testCreateErrorBasic('test', '{}', false, 403, 'You are not authorized to create resources', done);
    });

    it('should call error callback when the user is not the owner of the created resource', function(done) {
        var user = 'test';
        var resource = {
            relatedParty: [{ id: user, role: 'seller' }]
        }

        testCreateErrorBasic(user, JSON.stringify(resource), true, 403, 'The user making the request and the specified owner are not the same user', done);
    });

    it('should call ok callback when the user is the owner of the created resource', function(done) {

        var catalogApi = getCatalogApi({});

        var user = 'test';

        var req = {
            url: '/catalog/a/b',
            method: 'POST',
            body: JSON.stringify({
                relatedParty: [{ id: user, role: 'OwNeR' }]
            }),
            user: {
                id: user, 
                roles: [{ id: config.oauth2.roles.seller }] 
            }
        }

        catalogApi.checkPermissions(req, function() {
            done();
        });
    });

    var testCreateOffering = function(isOwner, productRequestFails, done) {

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
                roles: [{ id: config.oauth2.roles.seller }]
            },
            body: JSON.stringify({
                productSpecification: {
                    // the server will be avoided by the SW
                    // The catalog server will be used instead
                    href: config.appHost + ':' + config.endpoints.catalog.port + productPath
                }
            })
        }

        catalogApi.checkPermissions(req, function() {
            // This function should only be called when the user is the owner of the
            // offering and the attached product can be checked without problems
            expect(isOwner).toBe(true);
            expect(productRequestFails).toBe(false);

            done();
        }, function(status, errMsg) {

            // Check that this callback is only called when the user is not the owner
            // or when the product attached to the offering cannot be checked
            expect(!isOwner || productRequestFails).toBe(true);

            if (productRequestFails) {
                expect(status).toBe(400);
                expect(errMsg).toBe('The product specification of the given product offering is not valid');
            } else {
                expect(status).toBe(403);
                expect(errMsg).toBe('The user making the request and the specified owner are not the same user');
            }

            done();

        });
    }

    it('should call OK callback when creating an offering with an owned product', function(done) {
        testCreateOffering(true, false, done);
    });


    it('should call error callback when creating an offering with a non owned product', function(done) {
        testCreateOffering(false, false, done);
    });

    it('should call error callback when creating an offering and the attached product cannot be checked', function(done) {
        // isOwner does not matter when productRequestFails is set to true
        testCreateOffering(false, true, done);
    });

    var testCreateProduct = function(isOwner, productCreationFails, done) {

        var storeErrorStatus = '400';
        var storeErrorMessage = 'Invalid product';

        // Store Client
        var storeClient = {
            storeClient: {
                validateProduct: function(body, user, callback, callbackError) {
                    if (productCreationFails) {
                        callbackError(storeErrorStatus, storeErrorMessage);
                    } else {
                        callback();
                    }
                }
            }
        }

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
                roles: [{ id: config.oauth2.roles.seller }]
            },
            body: JSON.stringify(body)
        }

        catalogApi.checkPermissions(req, function() {
            // This function should only be called when the user is the owner of the product
            // and when the product is valid (according to the store client)
            expect(isOwner).toBe(true);
            expect(productCreationFails).toBe(false);

            done();
        }, function(status, errMsg) {

            // Check that this callback is only called when the user is not the owner
            // or when the product cannot be created
            expect(!isOwner || productCreationFails).toBe(true);

            if (productCreationFails) {
                expect(status).toBe(storeErrorStatus);
                expect(errMsg).toBe(storeErrorMessage);
            } else {
                expect(status).toBe(403);
                expect(errMsg).toBe('The user making the request and the specified owner are not the same user');
            }

            done();

        });
    }

    it('should call OK callback when creating an offering with an owned product', function(done) {
        testCreateProduct(true, false, done);
    });


    it('should call error callback when creating an offering with a non owned product', function(done) {
        testCreateProduct(false, false, done);
    });

    it('should call error callback when creating an offering and the attached product cannot be checked', function(done) {
        // isOwner does not matter when productRequestFails is set to true
        testCreateProduct(false, true, done);
    });

    var testUpdate = function(method, isOwner, requestFails, done) {

        var catalogApi = getCatalogApi({});

        var userName = 'test';
        var path = '/catalog/product/1';
        var protocol = config.appSsl ? 'https' : 'http';
        var url = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;
        var role = isOwner ? 'Owner': 'Seller';

        // User information is not sent when the request fails
        var statusOk = 200;
        var statusErr = 500;
        var statusCode = requestFails ? statusErr : statusOk;
        
        // Err is send when the request fails
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
        }

        catalogApi.checkPermissions(req, function() {
            // This function should only be called when the user is the owner of the resource
            // (To check this, the GET request to the resource should not fail)
            expect(isOwner).toBe(true);
            expect(requestFails).toBe(false);

            done();
        }, function(status, errMsg) {

            // Check that this callback is only called when the user is not the owner
            // or when the product cannot be got from the server
            expect(!isOwner || requestFails).toBe(true);

            if (requestFails) {
                expect(status).toBe(statusErr);
                expect(errMsg).toBe(bodyErr);
            } else {
                expect(status).toBe(403);
                expect(errMsg).toBe('The user making the request is not the owner of the accessed resource');
            }

            done();

        });
    }

    it('should call OK callback when user tries to update (PUT) a resource that owns', function(done) {
        testUpdate('PUT', true, false, done);
    });

    it('should call error callback when user tries to update (PUT) a resource that does not owns', function(done) {
        testUpdate('PUT', false, false, done);
    });

    it('should call error callback when user tries to update (PUT) a resource that does not owns', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('PUT', false, true, done);
    });

    it('should call OK callback when user tries to update (PATCH) a resource that owns', function(done) {
        testUpdate('PATCH', true, false, done);
    });

    it('should call error callback when user tries to update (PATCH) a resource that does not owns', function(done) {
        testUpdate('PATCH', false, false, done);
    });

    it('should call error callback when user tries to update (PATCH) a resource that does not owns', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('PATCH', false, true, done);
    });

    it('should call OK callback when user tries to delete a resource that owns', function(done) {
        testUpdate('DELETE', true, false, done);
    });

    it('should call error callback when user tries to delete a resource that does not owns', function(done) {
        testUpdate('DELETE', false, false, done);
    });

    it('should call error callback when user tries to delete a resource that does not owns', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('DELETE', false, true, done);
    });

    var testUpdateProductOffering = function(isOwner, productRequestFails, done) {

        var catalogApi = getCatalogApi({});

        // Basic properties
        var userName = 'test';
        var offeringPath = '/catalog/productOffering/1';
        var productPath = '/product/7';
        var protocol = config.appSsl ? 'https' : 'http';
        var serverUrl = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;
        
        // The mock server that will handle the request when the offering is requested
        var bodyGetOffering = { 
            productSpecification: {
                // the server will be avoided by the SW
                // The catalog server will be used instead
                href: config.appHost + ':' + config.endpoints.catalog.port + productPath
            }
        }

        var serverOffering = nock(serverUrl).get(offeringPath).reply(200, bodyGetOffering);

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
            method: 'PUT',
            url: offeringPath,
            user: {
                id: userName,
                roles: []
            }
        }

        catalogApi.checkPermissions(req, function() {
            // This function should only be called when the user is the owner of the offering
            // (The attached product is obtained to check this)
            expect(isOwner).toBe(true);
            expect(productRequestFails).toBe(false);

            done();
        }, function(status, errMsg) {

            // Check that this callback is only called when the user is not the owner
            // or when the attached product cannot be checked
            expect(!isOwner || productRequestFails).toBe(true);


            if (productRequestFails) {
                expect(status).toBe(400);
                expect(errMsg).toBe('The product specification of the given product offering is not valid');
            } else {
                expect(status).toBe(403);
                expect(errMsg).toBe('The user making the request is not the owner of the accessed resource');
            }

            done();

        });
    }

    it('should call OK callback when user tries to update an offering that owns', function(done) {
        testUpdateProductOffering(true, false, done);
    });


    it('should call error callback when user tries to update an offering that does not owns', function(done) {
        testUpdateProductOffering(false, false, done);
    });

    it('should call error callback when user tries to update an offering and the attached product cannot be checked', function(done) {
        // isOwner does not matter when productRequestFails is set to true
        testUpdateProductOffering(false, true, done);

    })

});