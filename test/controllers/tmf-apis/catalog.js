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

    beforeEach(function() {
        nock.cleanAll();
    });


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
        callback();
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

    var testCreateBasic = function(user, body, roles, error, expectedStatus, expectedErr,
                                   checkRoleMethod, owner, done) {

        var tmfUtils = {
            validateLoggedIn: validateLoggedOk,
            checkRole: checkRoleMethod,
            isOwner: owner ? isOwnerTrue : isOwnerFalse
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

    it('should reject creation requests with invalid JSON', function(done) {
        testCreateBasic('test', '{', [], true, 400, 'The provided body is not a valid JSON document', checkRoleTrue,
            true, done);
    });

    it('should reject creation requests when user has not the seller role', function(done) {
        testCreateBasic('test', '{}', [], true, 403, 'You are not authorized to create resources', checkRoleFalse,
            false, done);
    });

    it('should reject creation requests when related party role is not owner', function(done) {

        var user = 'test';
        var resource = {
            relatedParty: [{ name: user, role: 'invalid role' }]
        };

        testCreateBasic(user, JSON.stringify(resource), [{ name: config.oauth2.roles.seller }], true, 403,
            'The user making the request and the specified owner are not the same user', checkRoleTrue,
            false, done);
    });

    it('should allow to create resources when user is seller', function(done) {

        var user = 'test';
        var resource = {
            relatedParty: [{ id: user, role: 'OwNeR' }]
        };

        // Error parameters are not required when the resource can be created
        testCreateBasic(user, JSON.stringify(resource), [{ name: config.oauth2.roles.seller }], false, null, null,
            checkRoleTrue, true, done);
    });

    it('should allow to create resources when user is owner', function(done) {
        var user = 'admin';
        var resource = {
            relatedParty: [{ id: 'test', role: 'OwNeR' }]
        };
        testCreateBasic(user, JSON.stringify(resource), [{ name: config.oauth2.roles.admin }], false, null, null,
            checkRoleTrue, true, done);
    });

    var testCreateOffering = function(productRequestInfo, catalogRequestInfo, errorStatus, errorMsg, done) {

        var defaultErrorMessage = 'Internal Server Error';

        var tmfUtils = {
            validateLoggedIn: validateLoggedOk,
            checkRole: checkRoleTrue,
            isOwner: productRequestInfo.role.toLowerCase() === 'owner' ? isOwnerTrue : isOwnerFalse
        };

        var catalogApi = getCatalogApi({}, tmfUtils);

        // Basic properties
        var userName = 'test';
        var catalogPath = '/catalog/7';
        var offeringPath = catalogPath + '/productOffering';
        var productPath = '/product/7';
        var protocol = config.appSsl ? 'https' : 'http';
        var serverUrl = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;

        // The mock server that will handle the request when the product is requested
        var bodyGetProductOk = {
            relatedParty: [{id: userName, role: productRequestInfo.role}],
            lifecycleStatus: productRequestInfo.lifecycleStatus
        };
        var bodyGetProduct = productRequestInfo.requestStatus === 200 ? bodyGetProductOk : defaultErrorMessage;

        nock(serverUrl)
            .get(productPath)
            .reply(productRequestInfo.requestStatus, bodyGetProduct);

        // The mock server that will handle the request when the catalog is requested
        var bodyGetCatalogOk = {lifecycleStatus: catalogRequestInfo.lifecycleStatus};
        var bodyGetCatalog = catalogRequestInfo.requestStatus === 200 ? bodyGetCatalogOk : defaultErrorMessage;

        nock(serverUrl)
            .get(catalogPath)
            .reply(catalogRequestInfo.requestStatus, bodyGetCatalog);

        // Call the method
        var req = {
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

            if (errorStatus && errorMsg) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(errorStatus);
                expect(err.message).toBe(errorMsg);
            } else {
                expect(err).toBe(null);
            }

            done();
        });
    };

    it('should allow to create an offering with an owned product', function(done) {

        var productRequestInfo = {
            requestStatus: 200,
            role: 'Owner',
            lifecycleStatus: 'active'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'launched'
        };

        testCreateOffering(productRequestInfo, catalogRequestInfo, null, null, done);
    });

    it('should not allow to create an offering with a non owned product', function(done) {

        var productRequestInfo = {
            requestStatus: 200,
            role: 'Seller',
            lifecycleStatus: 'active'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'active'
        };

        testCreateOffering(productRequestInfo, catalogRequestInfo, 403, 'You are not allowed to create ' +
            'offerings for products you do not own', done);
    });

    it('should not allow to create an offering in a retired catalogue', function(done) {

        var productRequestInfo = {
            requestStatus: 200,
            role: 'Owner',
            lifecycleStatus: 'active'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'retired'
        };

        testCreateOffering(productRequestInfo, catalogRequestInfo, 400, 'Offerings can only be created in a ' +
            'catalog that is active or launched', done);
    });

    it('should not allow to create an offering for a retired product', function(done) {

        var productRequestInfo = {
            requestStatus: 200,
            role: 'Owner',
            lifecycleStatus: 'retired'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'active'
        };

        testCreateOffering(productRequestInfo, catalogRequestInfo, 400, 'Offerings can only be attached to ' +
            'active or launched products', done);
    });

    it('should not allow to create an offering when product cannot be retrieved', function(done) {

        var productRequestInfo = {
            requestStatus: 500,
            role: 'Owner',
            lifeCycleStatus: 'active'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'active'
        };

        testCreateOffering(productRequestInfo, catalogRequestInfo, 400, 'The product attached to the offering ' +
            'cannot be read', done);
    });

    it('should not allow to create an offering when the attached catalog cannot be retrieved', function(done) {

        var productRequestInfo = {
            requestStatus: 200,
            role: 'Owner',
            lifecycleStatus: 'active'
        };

        var catalogRequestInfo = {
            requestStatus: 500,
            lifecycleStatus: 'active'
        };

        // isOwner does not matter when productRequestFails is set to true
        testCreateOffering(productRequestInfo, catalogRequestInfo, 400, 'The catalog attached to the offering ' +
            'cannot be read', done);
    });

    var testCreateProduct = function(storeValidator, errorStatus, errorMsg, owner, done) {

        // Store Client
        var storeClient = {
            storeClient: {
                validateProduct: storeValidator
            }
        };

        var tmfUtils = {
            validateLoggedIn: validateLoggedOk,
            checkRole: checkRoleTrue,
            isOwner: owner ? isOwnerTrue : isOwnerFalse
        };

        var catalogApi = getCatalogApi(storeClient, tmfUtils);

        // Basic properties
        var userName = 'test';
        var offeringPath = '/catalog/productSpecification/1';
        var role = owner ? 'Owner': 'Seller';
        var body = { relatedParty: [{id: userName, role: role}]};

        // Call the method
        var req = {
            method: 'POST',
            url: offeringPath,
            user: {
                id: userName,
                roles: [{ name: config.oauth2.roles.seller }]
            },
            body: JSON.stringify(body)
        };

        catalogApi.checkPermissions(req, function(err) {

            if (!errorStatus && !errorMsg ) {
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

    it('should allow to create owned products', function(done) {
        testCreateProduct(storeValidatorOk, null, null, true, done);
    });

    it('should not allow to create non-owned products', function(done) {
        testCreateProduct(storeValidatorOk, 403, 'The user making the request and the specified ' +
            'owner are not the same user', false,  done);
    });

    it('should not allow to create products that cannot be retrieved from the Store', function(done) {

        var storeErrorStatus = 400;
        var storeErrorMessage = 'Invalid product';

        var storeValidatorErr = function(body, user, callback) {
            callback({ status: storeErrorStatus, message: storeErrorMessage });
        };

        // Actual call
        // isOwner does not matter when productRequestFails is set to true
        testCreateProduct(storeValidatorErr, storeErrorStatus, storeErrorMessage, true, done);
    });


    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////// UPDATE & DELETE //////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    // ANY ASSET

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
            },
            body: {}
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

    it('should allow to to update (PUT) an owned resource', function(done) {
        testUpdate('PUT', false, isOwnerTrue, done);
    });

    it('should not allow to update (PUT) a non-owned resource', function(done) {
        testUpdate('PUT', false, isOwnerFalse, done);
    });

    it('should not allow to update (PUT) a resource that cannot be checked', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('PUT', true, isOwnerTrue, done);
    });

    it('should allow to to update (PATCH) an owned resource', function(done) {
        testUpdate('PATCH', false, isOwnerTrue, done);
    });

    it('should not allow to update (PATCH) a non-owned resource', function(done) {
        testUpdate('PATCH', false, isOwnerFalse, done);
    });

    it('should not allow to update (PATCH) a resource that cannot be checked', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('PATCH', true, isOwnerTrue, done);
    });

    it('should allow to to delete owned resource', function(done) {
        testUpdate('DELETE', false, isOwnerTrue, done);
    });

    it('should not allow to delete a non-owned resource', function(done) {
        testUpdate('DELETE', false, isOwnerFalse, done);
    });

    it('should not allow to delete a resource that cannot be checked', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('DELETE', true, isOwnerTrue, done);
    });

    // OFFERINGS

    var testUpdateProductOffering = function(offeringBody, productRequestInfo, catalogRequestInfo, expectedErrorStatus,
                                             expectedErrorMsg, done) {

        var defaultErrorMessage = 'Internal Server Error';

        var tmfUtils = {
            validateLoggedIn: validateLoggedOk,
            checkRole: checkRoleTrue,
            isOwner: productRequestInfo.owner ? isOwnerTrue : isOwnerFalse
        };

        var catalogApi = getCatalogApi({}, tmfUtils);

        // Basic properties
        var userName = 'test';
        var catalogPath = '/catalog/8';
        var offeringPath = catalogPath + '/productOffering/1';
        var productPath = '/productSpecification/7';
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

        // The mock server that will handle the request when the product is requested
        var role = productRequestInfo.owner ? 'Owner': 'Seller';
        var bodyOk = { relatedParty: [{id: userName, role: role}], lifecycleStatus: productRequestInfo.lifecycleStatus};
        var bodyGetProduct = productRequestInfo.requestStatus === 200 ? bodyOk : defaultErrorMessage;

        nock(serverUrl)
            .get(productPath)
            .reply(productRequestInfo.requestStatus, bodyGetProduct);

        // The mock server that will handle the request when the catalog is requested
        var bodyGetCatalogOk = {lifecycleStatus: catalogRequestInfo.lifecycleStatus};
        var bodyGetCatalog = catalogRequestInfo.requestStatus === 200 ? bodyGetCatalogOk : defaultErrorMessage;

        nock(serverUrl)
            .get(catalogPath)
            .reply(catalogRequestInfo.requestStatus, bodyGetCatalog);

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
            },
            body: offeringBody
        };

        catalogApi.checkPermissions(req, function(err) {

            if (!expectedErrorStatus && !expectedErrorMsg) {
                expect(err).toBe(null);
            } else {
                expect(err.status).toBe(expectedErrorStatus);
                expect(err.message).toBe(expectedErrorMsg);
            }

            done();
        });
    };

    it('should allow to update an owned offering', function(done) {


        var productRequestInfo = {
            requestStatus: 200,
            owner: true,
            lifecycleStatus: 'active'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'active'
        };

        testUpdateProductOffering({}, productRequestInfo, catalogRequestInfo, null, null, done);
    });

    it('should not allow to update a non-owned offering', function(done) {

        var productRequestInfo = {
            requestStatus: 200,
            owner: false,
            lifecycleStatus: 'active'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'active'
        };

        testUpdateProductOffering({}, productRequestInfo, catalogRequestInfo, 403, 'You are not allowed to create ' +
            'offerings for products you do not own', done);
    });

    it('should not allow to update an offering when the attached product cannot be retrieved', function(done) {

        var productRequestInfo = {
            requestStatus: 500,
            owner: true,    // It does not matter
            lifecycleStatus: 'active'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'active'
        };

        testUpdateProductOffering({}, productRequestInfo, catalogRequestInfo, 400, 'The product attached to the ' +
            'offering cannot be read', done);
    });

    it('should allow to change the status of an offering to launched when product and catalog are launched', function(done) {

        var offeringBody = JSON.stringify({
            lifecycleStatus: 'launched'
        });

        var productRequestInfo = {
            requestStatus: 200,
            owner: true,
            lifecycleStatus: 'launched'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'launched'
        };
        testUpdateProductOffering(offeringBody, productRequestInfo, catalogRequestInfo, null, null, done);

    });

    it('should not allow to update offerings when the body is not a valid JSON', function(done) {
        testUpdateProductOffering('{ TEST', {}, {}, 400, 'The provided body is not a valid JSON', done);
    });

    it('should not allow to launch an offering when the catalog is active', function(done) {

        var offeringBody = JSON.stringify({
            lifecycleStatus: 'launched'
        });

        var productRequestInfo = {
            requestStatus: 200,
            owner: true,
            lifecycleStatus: 'launched'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'active'
        };

        testUpdateProductOffering(offeringBody, productRequestInfo, catalogRequestInfo, 400, 'Offerings can only be ' +
            'launched when the attached catalog is also launched', done);
    });

    it('should not allow to launch an offering when the product is active', function(done) {

        var offeringBody = JSON.stringify({
            lifecycleStatus: 'launched'
        });

        var productRequestInfo = {
            requestStatus: 200,
            owner: true,
            lifecycleStatus: 'active'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'launched'
        };

        testUpdateProductOffering(offeringBody, productRequestInfo, catalogRequestInfo, 400, 'Offerings can only be ' +
            'launched when the attached product is also launched', done);
    });

    // PRODUCTS & CATALOGS

    var testChangeProductCatalogStatus = function(assetPath, offeringsPath, assetBody,
                                                  offeringsInfo, errorStatus, errorMsg, done) {

        var defaultErrorMessage = 'Internal Server Error';

        var tmfUtils = {
            validateLoggedIn: validateLoggedOk,
            checkRole: checkRoleTrue,
            isOwner: function () {
                return true;
            }
        };

        var catalogApi = getCatalogApi({}, tmfUtils);

        // Basic properties
        var userName = 'test';
        var protocol = config.appSsl ? 'https' : 'http';
        var serverUrl = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;

        // The service will check that the user is the owner of the offering by making a request
        // to the API. However, a body is not required since the function isOwner has been set up
        // to return always true.
        nock(serverUrl)
            .get(assetPath)
            .reply(200, { });

        // The service that all the offerings are in a valid state to complete the status change
        var bodyGetOfferings = offeringsInfo.requestStatus === 200 ? offeringsInfo.offerings : defaultErrorMessage;

        nock(serverUrl)
            .get(offeringsPath)
            .reply(offeringsInfo.requestStatus, bodyGetOfferings);

        // Call the method
        var req = {
            // If the previous tests works, it can be deducted that PUT, PATCH and DELETE
            // requests are handled in the same way so here we do not need additional tests
            // for the different HTTP verbs.
            method: 'PATCH',
            url: assetPath,
            user: {
                id: userName,
                roles: [{ name: config.oauth2.roles.seller }]
            },
            body: assetBody
        };

        catalogApi.checkPermissions(req, function(err) {

            if (errorStatus && errorMsg) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(errorStatus);
                expect(err.message).toBe(errorMsg);
            } else {
                expect(err).toBe(null);
            }

            done();
        });
    };

    // PRODUCTS

    var testChangeProductStatus = function(productBody, offeringsInfo, errorStatus, errorMsg, done) {

        var productId = '7';
        var productPath = '/productSpecification/' + productId;
        var offeringsPath = '/productOffering?productSpecification.id=' + productId;

        testChangeProductCatalogStatus(productPath, offeringsPath, productBody, offeringsInfo,
                errorStatus, errorMsg, done);
    };

    it('should not allow to retire a product when the body is invalid', function(done) {

        var productBody = "{'lifecycleStatus': retired}";

        var offeringsInfo = {
            requestStatus: 200,
            offerings: []
        };

        testChangeProductStatus(productBody, offeringsInfo, 400, 'The provided body is not a valid JSON', done);

    });

    it('should allow to update a product if the body does not contains cycle information', function(done) {

        var productBody = {};

        var offeringsInfo = {
            requestStatus: 200,
            offerings: []
        };

        testChangeProductStatus(productBody, offeringsInfo, null, null, done);

    });

    it('should allow launch a product', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'launched'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: []
        };

        testChangeProductStatus(productBody, offeringsInfo, null, null, done);

    });

    // Retire

    it('should allow to retire a product when there are no attached offerings', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: []
        };

        testChangeProductStatus(productBody, offeringsInfo, null, null, done);
    });

    it('should allow to retire a product when there is one attached offering with retired status', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'ReTiReD'
            }]
        };

        testChangeProductStatus(productBody, offeringsInfo, null, null, done);
    });

    it('should allow to retire a product when there is one attached offering with obsolete status', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'ObSoLeTe'
            }]
        };

        testChangeProductStatus(productBody, offeringsInfo, null, null, done);
    });

    it('should not allow to retire a product when there is one attached offering with active status', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'AcTIve'
            }]
        };

        testChangeProductStatus(productBody, offeringsInfo, 400, 'All the attached offerings must be retired or ' +
            'obsolete to retire a product', done);
    });

    it('should allow to retire a product when there are two attached offerings - one retired and one obsolete', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'ObSoLEte'
            }, {
                lifecycleStatus: 'RetiReD'
            }]
        };

        testChangeProductStatus(productBody, offeringsInfo, null, null, done);
    });

    it('should not allow to retire a product when there is at least one attached offering with launched status', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'retired'
            }, {
                lifecycleStatus: 'launched'
            }]
        };

        testChangeProductStatus(productBody, offeringsInfo, 400, 'All the attached offerings must be retired or ' +
            'obsolete to retire a product', done);
    });

    it('should not allow to retire a product if the attached offerings cannot be retrieved', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 404,
            offerings: []
        };

        testChangeProductStatus(productBody, offeringsInfo, 400, 'Attached offerings cannot be retrieved', done);

    });

    // Make obsolete

    it('should allow to make a product obsolete when there are no attached offerings', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'obsolete'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: []
        };

        testChangeProductStatus(productBody, offeringsInfo, null, null, done);
    });

    it('should allow to make a product obsolete when there is one attached offering with obsolete status', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'obsolete'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'ObSoLeTE'
            }]
        };

        testChangeProductStatus(productBody, offeringsInfo, null, null, done);
    });

    it('should not allow to make a product obsolete when there is one attached offering with retired status', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'obsolete'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'retired'
            }]
        };

        testChangeProductStatus(productBody, offeringsInfo, 400, 'All the attached offerings must be obsolete to ' +
            'make a product obsolete', done);
    });

    it('should allow to make a product obsolete when there are two attached obsolete offerings', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'obsolete'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'ObSoLEte'
            }, {
                lifecycleStatus: 'obsolete'
            }]
        };

        testChangeProductStatus(productBody, offeringsInfo, null, null, done);
    });

    it('should not allow to make a product obsolete when there is at least one attached offering with retired status', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'ObsOletE'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'retired'
            }, {
                lifecycleStatus: 'obsolete'
            }]
        };

        testChangeProductStatus(productBody, offeringsInfo, 400, 'All the attached offerings must be obsolete to ' +
            'make a product obsolete', done);
    });

    it('should not allow to make a product obsolete if the attached offerings cannot be retrieved', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'obsolete'
        });

        var offeringsInfo = {
            requestStatus: 404,
            offerings: []
        };

        testChangeProductStatus(productBody, offeringsInfo, 400, 'Attached offerings cannot be retrieved', done);

    });

    // CATALOGS

    var testChangeCatalogStatus = function(productBody, offeringsInfo, errorStatus, errorMsg, done) {

        var catalogPath = '/catalog/7';
        var offeringsPath = catalogPath + '/productOffering';

        testChangeProductCatalogStatus(catalogPath, offeringsPath, productBody, offeringsInfo,
                errorStatus, errorMsg, done);
    };

    it('should not allow to retire a catalog when the body is invalid', function(done) {

        var productBody = "{'lifecycleStatus': retired}";

        var offeringsInfo = {
            requestStatus: 200,
            offerings: []
        };

        testChangeCatalogStatus(productBody, offeringsInfo, 400, 'The provided body is not a valid JSON', done);

    });

    it('should allow to update a catalog if the body does not contains cycle information', function(done) {

        var productBody = {};

        var offeringsInfo = {
            requestStatus: 200,
            offerings: []
        };

        testChangeCatalogStatus(productBody, offeringsInfo, null, null, done);

    });

    it('should allow launch a catalog', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'launched'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'active'
            }]
        };

        testChangeCatalogStatus(productBody, offeringsInfo, null, null, done);

    });

    // Retire

    it('should allow to retire a catalog when there are no attached offerings', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: []
        };

        testChangeCatalogStatus(productBody, offeringsInfo, null, null, done);
    });

    it('should allow to retire a catalog when there is one attached offering with retired status', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'ReTiReD'
            }]
        };

        testChangeCatalogStatus(productBody, offeringsInfo, null, null, done);
    });

    it('should allow to retire a catalog when there is one attached offering with obsolete status', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'ObSoLeTe'
            }]
        };

        testChangeCatalogStatus(productBody, offeringsInfo, null, null, done);
    });

    it('should not allow to retire a catalog when there is one attached offering with active status', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'AcTIve'
            }]
        };

        testChangeCatalogStatus(productBody, offeringsInfo, 400, 'All the attached offerings must be retired or ' +
            'obsolete to retire a catalog', done);
    });

    it('should allow to retire a catalog when there are two attached offerings - one retired and one obsolete', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'ObSoLEte'
            }, {
                lifecycleStatus: 'RetiReD'
            }]
        };

        testChangeCatalogStatus(productBody, offeringsInfo, null, null, done);
    });

    it('should not allow to retire a catalog when there is at least one attached offering with launched status', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'retired'
            }, {
                lifecycleStatus: 'launched'
            }]
        };

        testChangeCatalogStatus(productBody, offeringsInfo, 400, 'All the attached offerings must be retired or ' +
            'obsolete to retire a catalog', done);
    });

    it('should not allow to retire a catalog if the attached offerings cannot be retrieved', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 404,
            offerings: []
        };

        testChangeCatalogStatus(productBody, offeringsInfo, 400, 'Attached offerings cannot be retrieved', done);

    });

    // Make obsolete

    it('should allow to make a catalog obsolete when there are no attached offerings', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'obsolete'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: []
        };

        testChangeCatalogStatus(productBody, offeringsInfo, null, null, done);
    });

    it('should allow to make a catalog obsolete when there is one attached offering with obsolete status', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'obsolete'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'ObSoLeTE'
            }]
        };

        testChangeCatalogStatus(productBody, offeringsInfo, null, null, done);
    });

    it('should not allow to make a catalog obsolete when there is one attached offering with retired status', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'obsolete'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'retired'
            }]
        };

        testChangeCatalogStatus(productBody, offeringsInfo, 400, 'All the attached offerings must be obsolete to ' +
            'make a catalog obsolete', done);
    });

    it('should allow to make a catalog obsolete when there are two attached obsolete offerings', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'obsolete'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'ObSoLEte'
            }, {
                lifecycleStatus: 'obsolete'
            }]
        };

        testChangeCatalogStatus(productBody, offeringsInfo, null, null, done);
    });

    it('should not allow to make a catalog obsolete when there is at least one attached offering with retired status', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'ObsOletE'
        });

        var offeringsInfo = {
            requestStatus: 200,
            offerings: [{
                lifecycleStatus: 'retired'
            }, {
                lifecycleStatus: 'obsolete'
            }]
        };

        testChangeCatalogStatus(productBody, offeringsInfo, 400, 'All the attached offerings must be obsolete to ' +
            'make a catalog obsolete', done);
    });

    it('should not allow to make a catalog obsolete if the attached offerings cannot be retrieved', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'obsolete'
        });

        var offeringsInfo = {
            requestStatus: 404,
            offerings: []
        };

        testChangeCatalogStatus(productBody, offeringsInfo, 400, 'Attached offerings cannot be retrieved', done);

    });
});