var nock = require('nock'),
    proxyquire =  require('proxyquire'),
    testUtils = require('../../utils');


describe('Catalog API', function() {

    var config = testUtils.getDefaultConfig();

    var getCatalogApi = function(storeClient, tmfUtils) {
        return proxyquire('../../../controllers/tmf-apis/catalog', {
            './../../config': config,
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/store': storeClient,
            './../../lib/tmfUtils': tmfUtils
        }).catalog;
    };


    //////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////// GET ////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    it('should call OK callback on GET requests', function(done) {

        var catalogApi = getCatalogApi({}, {});

        var req = {
            method: 'GET',
            // user: { roles: [] }
        };

        catalogApi.checkPermissions(req, function() {
            // Callback function. It's called without arguments...
            done();
        });
    });


    //////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////// NOT AUTHENTICATED /////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var validateLoggedError = function(req, callback) {
        callback({
            status: 401,
            message: 'You need to be authenticated to create/update/delete resources'
        });
    };

    var testNotLoggedIn = function(method, done) {

        var tmfUtils = {
            validateLoggedIn: validateLoggedError
        };

        var catalogApi = getCatalogApi({}, tmfUtils);
        var path = '/catalog/product/1';

        // Call the method
        var req = {
            method: method,
            url: path
        };

        catalogApi.checkPermissions(req, function(err) {

            expect(err).not.toBe(null);
            expect(err.status).toBe(401);
            expect(err.message).toBe('You need to be authenticated to create/update/delete resources');

            done();
        });
    };

    it('should reject not authenticated POST requests', function(done) {
        testNotLoggedIn('POST', done);
    });

    it('should reject not authenticated PUT requests', function(done) {
        testNotLoggedIn('PUT', done);
    });

    it('should reject not authenticated PATCH requests', function(done) {
        testNotLoggedIn('PATCH', done);
    });

    it('should reject not authenticated DELETE requests', function(done) {
        testNotLoggedIn('DELETE', done);
    });


    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////// CREATE ///////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var validateLoggedOk = function(req, callback) {
        callback()
    };

    var checkRoleFalse = function(userInfo, role) {
        return false;
    };

    var checkRoleTrue = function(userInfo, role) {
        return true;
    };

    var isOwnerFalse = function(userInfo, info) {
        return false;
    };

    var isOwnerTrue = function(userInfo, info) {
        return true;
    };

    var testCreateBasic = function(user, body, roles, error, expectedStatus, expectedErr, checkRoleMethod, isOwnerMethod, done) {

        var tmfUtils = {
            validateLoggedIn: validateLoggedOk,
            checkRole: checkRoleMethod,
            isOwner: isOwnerMethod
        };

        var catalogApi = getCatalogApi({}, tmfUtils);

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
        testCreateBasic('test', '{', [], true, 400, 'The resource is not a valid JSON document', checkRoleTrue, isOwnerTrue, done);
    });

    it('should call error callback when user is not a seller', function(done) {
        testCreateBasic('test', '{}', [], true, 403, 'You are not authorized to create resources', checkRoleFalse, isOwnerFalse,  done);
    });

    it('should call error callback when the user is not the owner of the created resource', function(done) {
        var user = 'test';
        var resource = {
            relatedParty: [{ name: user, role: 'invalid role' }]
        };

        testCreateBasic(
            user,
            JSON.stringify(resource),
            [{ name: config.oauth2.roles.seller }],
            true,
            403,
            'The user making the request and the specified owner are not the same user',
            checkRoleTrue,
            isOwnerFalse,
            done);
    });

    it('should call ok callback when the user is the owner of the created resource', function(done) {

        var user = 'test';
        var resource = {
            relatedParty: [{ id: user, role: 'OwNeR' }]
        };

        // Error parameters are not required when the resource can be created
        testCreateBasic(user, JSON.stringify(resource), [{ name: config.oauth2.roles.seller }], false, null, null, checkRoleTrue, isOwnerTrue, done);
    });

    it('should call ok callback when the user is admin', function(done) {
        var user = 'admin';
        var resource = {
            relatedParty: [{ id: 'test', role: 'OwNeR' }]
        };
        testCreateBasic(user, JSON.stringify(resource), [{ name: config.oauth2.roles.admin }], false, null, null, checkRoleTrue, isOwnerTrue, done);
    });

    var testCreateOffering = function(productRequestFails, errorStatus, errorMsg, isOwnerMethod, done) {

        var tmfUtils = {
            validateLoggedIn: validateLoggedOk,
            checkRole: checkRoleTrue,
            isOwner: isOwnerMethod
        };

        var catalogApi = getCatalogApi({}, tmfUtils);

        // Basic properties
        var userName = 'test';
        var catalogPath = '/catalog/7';
        var offeringPath = catalogPath + '/productOffering/1';
        var productPath = '/product/7';
        var protocol = config.appSsl ? 'https' : 'http';
        var serverUrl = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;

        // The mock server that will handle the request when the catalog is requested
        nock(serverUrl)
            .get(catalogPath)
            .reply(200, { lifecycleStatus: 'active' });

        // The mock server that will handle the request when the product is requested
        var statusOk = 200;
        var statusErr = 500;
        var statusCodeGetProduct = productRequestFails ? statusErr : statusOk;

        var role = isOwnerMethod() ? 'Owner': 'Seller';
        var bodyOk = { relatedParty: [{id: userName, role: role}], lifecycleStatus: 'active'};
        var bodyErr = 'Internal Server Error';
        var bodyGetProduct = productRequestFails ? bodyErr : bodyOk;

        nock(serverUrl)
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

            if (isOwnerMethod() && !productRequestFails) {
                expect(err).toBe(null);
            } else {
                expect(err.status).toBe(errorStatus);
                expect(err.message).toBe(errorMsg);
            }

            done();
        });
    };

    it('should call OK callback when creating an offering with an owned product', function(done) {
        testCreateOffering(false, null, null, isOwnerTrue, done);
    });


    it('should call error callback when creating an offering with a non owned product', function(done) {
        testCreateOffering(false, 403, 'The user making the request and the specified owner are not the same user', isOwnerFalse, done);
    });

    it('should call error callback when creating an offering and the attached product cannot be checked', function(done) {
        // isOwner does not matter when productRequestFails is set to true
        testCreateOffering(true, 400, 'The product specification of the given product offering is not valid', isOwnerTrue, done);
    });

    var testCreateProduct = function(storeValidator, errorStatus, errorMsg, isOwnerMethod, done) {

        // Store Client
        var storeClient = {
            storeClient: {
                validateProduct: storeValidator
            }
        };

        var tmfUtils = {
            validateLoggedIn: validateLoggedOk,
            checkRole: checkRoleTrue,
            isOwner: isOwnerMethod
        };

        var catalogApi = getCatalogApi(storeClient, tmfUtils);

        // Basic properties
        var userName = 'test';
        var offeringPath = '/catalog/productSpecification/1';
        var role = isOwnerMethod() ? 'Owner': 'Seller';
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
        testCreateProduct(storeValidatorOk, null, null, isOwnerTrue, done);
    });

    it('should call error callback when creating a non owned product', function(done) {
        testCreateProduct(storeValidatorOk, 403, 'The user making the request and the specified owner are not the same user', isOwnerFalse,  done);
    });

    it('should call error callback when creating a product that cannot be checked by the store', function(done) {

        var storeErrorStatus = 400;
        var storeErrorMessage = 'Invalid product';

        var storeValidatorErr = function(body, user, callback) {
            callback({ status: storeErrorStatus, message: storeErrorMessage });
        };

        // Actual call
        // isOwner does not matter when productRequestFails is set to true
        testCreateProduct(storeValidatorErr, storeErrorStatus, storeErrorMessage, isOwnerTrue, done);
    });


    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////// UPDATE & DELETE //////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    var testUpdate = function(method, requestFails, isOwnerMethod, done) {

        var tmfUtils = {
            validateLoggedIn: validateLoggedOk,
            checkRole: checkRoleTrue,
            isOwner: isOwnerMethod
        };

        var catalogApi = getCatalogApi({}, tmfUtils);

        var userName = 'test';
        var path = '/catalog/product/1';
        var protocol = config.appSsl ? 'https' : 'http';
        var url = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;
        var role = isOwnerMethod() ? 'Owner': 'Seller';

        // statusCode depends on whether the request fails or not 
        var statusOk = 200;
        var statusErr = 500;
        var statusCode = requestFails ? statusErr : statusOk;
        
        // User information is send when the request does not fail
        var bodyOk = { relatedParty: [{id: userName, role: role}]};
        var bodyErr = 'Internal Server Error';
        var returnedBody = requestFails ? bodyErr : bodyOk;

        // The mock server that will handle the request
        nock(url)
            .get(path)
            .reply(statusCode, returnedBody);

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

            if (isOwnerMethod() && !requestFails) {
                expect(err).toBe(null);
            } else if (requestFails) {
                expect(err.status).toBe(400);
                expect(err.message).toBe('The TMForum APIs fails to retrieve the object you are trying to update/delete');
            } else {
                expect(err.status).toBe(403);
                expect(err.message).toBe('The user making the request is not the owner of the accessed resource');
            }

            done();
        });
    };

    it('should call OK callback when user tries to update (PUT) a resource that owns', function(done) {
        testUpdate('PUT', false, isOwnerTrue, done);
    });

    it('should call error callback when user tries to update (PUT) a resource that does not owns', function(done) {
        testUpdate('PUT', false, isOwnerFalse, done);
    });

    it('should call error callback when user tries to update (PUT) a resource that cannot be checked', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('PUT', true, isOwnerTrue, done);
    });

    it('should call OK callback when user tries to update (PATCH) a resource that owns', function(done) {
        testUpdate('PATCH', false, isOwnerTrue, done);
    });

    it('should call error callback when user tries to update (PATCH) a resource that does not owns', function(done) {
        testUpdate('PATCH', false, isOwnerFalse, done);
    });

    it('should call error callback when user tries to update (PATCH) a resource that cannot be checked', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('PATCH', true, isOwnerTrue, done);
    });

    it('should call OK callback when user tries to delete a resource that owns', function(done) {
        testUpdate('DELETE', false, isOwnerTrue, done);
    });

    it('should call error callback when user tries to delete a resource that does not owns', function(done) {
        testUpdate('DELETE', false, isOwnerFalse, done);
    });

    it('should call error callback when user tries to delete a resource that cannot be checked', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('DELETE', true, isOwnerTrue, done);
    });

    var testUpdateProductOffering = function(productRequestFails, expectedErrorStatus, expectedErrorMsg, isOwnerMethod, done) {

        var tmfUtils = {
            validateLoggedIn: validateLoggedOk,
            checkRole: checkRoleTrue,
            isOwner: isOwnerMethod
        };

        var catalogApi = getCatalogApi({}, tmfUtils);

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

        nock(serverUrl)
            .get(offeringPath)
            .reply(200, bodyGetOffering);

        // HTTP MOCK - PRODUCT (THE ONE ATTACHED TO THE OFFERING)
        var statusOk = 200;
        var statusErr = 500;
        var statusCodeGetProduct = productRequestFails ? statusErr : statusOk;

        var role = isOwnerMethod() ? 'Owner': 'Seller';
        var bodyOk = { relatedParty: [{id: userName, role: role}]};
        var bodyErr = 'Internal Server Error';
        var bodyGetProduct = productRequestFails ? bodyErr : bodyOk;

        nock(serverUrl)
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

            if (isOwnerMethod() && !productRequestFails) {
                expect(err).toBe(null);
            } else {
                expect(err.status).toBe(expectedErrorStatus);
                expect(err.message).toBe(expectedErrorMsg);
            }

            done();
        });
    };

    it('should call OK callback when user tries to update an offering that owns', function(done) {
        testUpdateProductOffering(false, null, null, isOwnerTrue, done);
    });

    it('should call error callback when user tries to update an offering that does not owns', function(done) {
        testUpdateProductOffering(false, 403, 'The user making the request is not the owner of the accessed resource', isOwnerFalse, done);
    });

    it('should call error callback when user tries to update an offering and the attached product cannot be checked', function(done) {
        // isOwner does not matter when productRequestFails is set to true
        testUpdateProductOffering(true, 400, 'The product specification of the given product offering is not valid', isOwnerTrue, done);
    });

});