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

var nock = require('nock'),
    proxyquire =  require('proxyquire'),
    testUtils = require('../../utils');

// ERRORS
var PARENT_ID_INCLUDED = 'Parent ID cannot be included when the category is root';
var MISSING_PARENT_ID = 'Non-root categories must contain a parent category';
var FAILED_TO_RETRIEVE = 'The TMForum APIs fails to retrieve the object you are trying to update/delete';
var NEED_AUTHENTICATION = 'You need to be authenticated to create/update/delete resources';
var INVALID_JSON = 'The provided body is not a valid JSON';
var CREATE_OFFERING_FOR_NON_OWNED_PRODUCT = 'You are not allowed to create offerings for products you do not own';
var UPDATE_OFFERING_WITH_NON_OWNED_PRODUCT = 'You are not allowed to update offerings for products you do not own';
var INVALID_PRODUCT = 'The product attached to the offering cannot be read';
var INVALID_USER_CREATE = 'The user making the request and the specified owner are not the same user';
var INVALID_USER_UPDATE = 'The user making the request is not the owner of the accessed resource';
var OFFERS_NOT_RETIRED_PRODUCT = 'All the attached offerings must be retired or obsolete to retire a product';
var OFFERS_NOT_RETIRED_CATALOG = 'All the attached offerings must be retired or obsolete to retire a catalog';
var OFFERS_NOT_OBSOLETE_PRODUCT = 'All the attached offerings must be obsolete to make a product obsolete';
var OFFERS_NOT_OBSOLETE_CATALOG = 'All the attached offerings must be obsolete to make a catalog obsolete';
var ONLY_ADMINS_MODIFY_CATEGORIES = 'Only administrators can modify categories';
var OFFERINGS_NOT_RETRIEVED = 'Attached offerings cannot be retrieved';
var CATEGORY_EXISTS = 'This category already exists';
var CATEGORIES_CANNOT_BE_CHECKED = 'It was impossible to check if the provided category already exists';
var CATEGORY_NAME_MISSING = 'Category name is mandatory';
var CATALOG_CANNOT_BE_CHECKED = 'It was impossible to check if there is another catalog with the same name';
var CATALOG_EXISTS = 'This catalog name is already taken';
var RSS_CANNOT_BE_ACCESSED = 'An unexpected error in the RSS API prevented your request to be processed';
var INVALID_PRODUCT_CLASS = 'The provided productClass does not specify a valid revenue sharing model';


describe('Catalog API', function() {

    var config = testUtils.getDefaultConfig();

    var getCatalogApi = function(storeClient, tmfUtils, utils, rssClient) {
        if (!rssClient) {
            rssClient = {};
        }

        return proxyquire('../../../controllers/tmf-apis/catalog', {
            './../../config': config,
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/store': storeClient,
            './../../lib/rss': rssClient,
            './../../lib/tmfUtils': tmfUtils,
            './../../lib/utils': utils
        }).catalog;
    };

    beforeEach(function() {
        nock.cleanAll();
    });


    //////////////////////////////////////////////////////////////////////////////////////////////
    ///////////////////////////////////////////// GET ////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    it('should call OK callback on GET requests', function(done) {

        var catalogApi = getCatalogApi({}, {}, {});

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
            message: NEED_AUTHENTICATION
        });
    };

    var testNotLoggedIn = function(method, done) {

        var utils = {
            validateLoggedIn: validateLoggedError
        };

        var catalogApi = getCatalogApi({}, {}, utils);
        var path = '/catalog/product/1';

        // Call the method
        var req = {
            method: method,
            apiUrl: path
        };

        catalogApi.checkPermissions(req, function(err) {

            expect(err).not.toBe(null);
            expect(err.status).toBe(401);
            expect(err.message).toBe(NEED_AUTHENTICATION);

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

    var isOwnerFalse = function(userInfo, info) {
        return false;
    };

    var isOwnerTrue = function(userInfo, info) {
        return true;
    };

    var testCreateBasic = function(user, body, roles, error, expectedStatus, expectedErr,
                                   isSeller, sellerChecked, owner, done) {

        var checkRoleMethod = jasmine.createSpy();
        checkRoleMethod.and.returnValue(isSeller);

        var tmfUtils = {
            isOwner: owner ? isOwnerTrue : isOwnerFalse
        };

        var utils = {
            validateLoggedIn: validateLoggedOk,
            hasRole: checkRoleMethod
        };

        var catalogApi = getCatalogApi({}, tmfUtils, utils);

        var req = {
            apiUrl: '/catalog/a/b',
            method: 'POST',
            body: body,
            user: {
                id: user, 
                roles: roles 
            }
        };

        catalogApi.checkPermissions(req, function(err) {

            if (sellerChecked) {
                expect(checkRoleMethod).toHaveBeenCalledWith(req.user, config.oauth2.roles.seller);
            }

            expect(checkRoleMethod.calls.count()).toBe(sellerChecked ? 1 : 0);

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
        testCreateBasic('test', '{', [], true, 400, INVALID_JSON, true, false,
            true, done);
    });

    it('should reject creation requests when user has not the seller role', function(done) {
        testCreateBasic('test', '{}', [], true, 403, 'You are not authorized to create resources', false, true,
            false, done);
    });

    it('should reject creation requests when related party role is not owner', function(done) {

        var user = 'test';
        var resource = {
            relatedParty: [{ name: user, role: 'invalid role' }]
        };

        testCreateBasic(user, JSON.stringify(resource), [{ name: config.oauth2.roles.seller }], true, 403,
            INVALID_USER_CREATE, true, true, false, done);
    });

    it('should allow to create resources when user is seller', function(done) {

        var user = 'test';
        var resource = {
            relatedParty: [{ id: user, role: 'OwNeR' }]
        };

        // Error parameters are not required when the resource can be created
        testCreateBasic(user, JSON.stringify(resource), [{ name: config.oauth2.roles.seller }], false, null, null,
            true, true, true, done);
    });

    var testCreateOffering = function(productRequestInfo, catalogRequestInfo, storeError, errorStatus, errorMsg, rssResp, done) {

        // Basic properties
        var userName = 'test';
        var catalogPath = '/catalog/7';
        var offeringPath = catalogPath + '/productOffering';
        var productPath = '/product/7';
        var protocol = config.appSsl ? 'https' : 'http';
        var serverUrl = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;

        var user = {
            id: userName,
            roles: [{ name: config.oauth2.roles.seller }]
        };

        var body = {
            productSpecification: {
                // the server will be avoided by the SW
                // The catalog server will be used instead
                href: config.appHost + ':' + config.endpoints.catalog.port + productPath
            },
            serviceCandidate: {
                id: 'productClass'
            }
        };

        // Mocks
        var checkRoleMethod = jasmine.createSpy();
        checkRoleMethod.and.returnValue(true);

        var defaultErrorMessage = 'Internal Server Error';

        var tmfUtils = {
            isOwner: productRequestInfo.role.toLowerCase() === 'owner' ? isOwnerTrue : isOwnerFalse
        };

        var utils = {
            validateLoggedIn: validateLoggedOk,
            hasRole: checkRoleMethod
        };

        var storeClient = {
            storeClient: {
                validateOffering: function (offeringInfo, userInfo, callback) {

                    expect(offeringInfo).toEqual(body);
                    expect(userInfo).toEqual(user);

                    callback(storeError);
                }
            }
        };

        if (!rssResp) {
            rssResp = {
                provider: null,
                modelErr: null,
                modelBody: {
                    body: JSON.stringify([{}])
                }
            };
        }

        var rssClient = {
            rssClient: {
                createProvider: function(userInfo, callback) {
                    expect(userInfo).toEqual(user);
                    callback(rssResp.provider);
                },
                retrieveRSModel: function(userInfo, productClass, callback) {
                    expect(userInfo).toEqual(user);
                    callback(rssResp.modelErr, rssResp.modelBody);
                }
            }
        };

        var catalogApi = getCatalogApi(storeClient, tmfUtils, utils, rssClient);

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
            apiUrl: offeringPath,
            user: user,
            body: JSON.stringify(body)
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

        testCreateOffering(productRequestInfo, catalogRequestInfo, null, null, null, null, done);
    });

    it('should not allow to create an offering when store validation fails', function(done) {

        var productRequestInfo = {
            requestStatus: 200,
            role: 'Owner',
            lifecycleStatus: 'active'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'launched'
        };

        var storeResponse = {
            status: 400,
            message: 'Invalid pricing'
        };

        testCreateOffering(productRequestInfo, catalogRequestInfo, storeResponse, storeResponse.status,
            storeResponse.message, null, done);
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

        testCreateOffering(productRequestInfo, catalogRequestInfo, null, 403, CREATE_OFFERING_FOR_NON_OWNED_PRODUCT, null, done);
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

        testCreateOffering(productRequestInfo, catalogRequestInfo, null, 400, 'Offerings can only be created in a ' +
            'catalog that is active or launched', null, done);
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

        testCreateOffering(productRequestInfo, catalogRequestInfo, null, 400, 'Offerings can only be attached to ' +
            'active or launched products', null, done);
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

        testCreateOffering(productRequestInfo, catalogRequestInfo, null, 500, INVALID_PRODUCT, null, done);
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
        testCreateOffering(productRequestInfo, catalogRequestInfo, null, 500, 'The catalog attached to the offering ' +
            'cannot be read', null, done);
    });

    it('should not allow to create an offering when the RSS provider cannot be verified', function(done) {
        var productRequestInfo = {
            requestStatus: 200,
            role: 'Owner',
            lifecycleStatus: 'active'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'launched'
        };

        testCreateOffering(productRequestInfo, catalogRequestInfo, null, 500, RSS_CANNOT_BE_ACCESSED, {
            provider: {}
        }, done);
    });

    it ('should not allow to create an offering when the RSS fails retrieving models', function(done) {
        var errMsg = 'RSS failure';
        var status = 500;

        var productRequestInfo = {
            requestStatus: 200,
            role: 'Owner',
            lifecycleStatus: 'active'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'launched'
        };

        testCreateOffering(productRequestInfo, catalogRequestInfo, null, status, errMsg, {
            provider: null,
            modelErr: {
                status: status,
                message: errMsg,
            }
        }, done);
    });

    it ('should not allow to create an offering when there are not RS Models', function(done) {
        var productRequestInfo = {
            requestStatus: 200,
            role: 'Owner',
            lifecycleStatus: 'active'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'launched'
        };

        testCreateOffering(productRequestInfo, catalogRequestInfo, null, 422, INVALID_PRODUCT_CLASS, {
            provider: null,
            modelErr: null,
            modelBody: {
                body: JSON.stringify([])
            }
        }, done);
    });

    var testCreateProduct = function(storeValidator, errorStatus, errorMsg, owner, done) {

        var checkRoleMethod = jasmine.createSpy();
        checkRoleMethod.and.returnValue(true);

        // Store Client
        var storeClient = {
            storeClient: {
                validateProduct: storeValidator
            }
        };

        var tmfUtils = {
            isOwner: owner ? isOwnerTrue : isOwnerFalse
        };

        var utils = {
            validateLoggedIn: validateLoggedOk,
            hasRole: checkRoleMethod
        };

        var catalogApi = getCatalogApi(storeClient, tmfUtils, utils);

        // Basic properties
        var userName = 'test';
        var offeringPath = '/catalog/productSpecification/';
        var role = owner ? 'Owner': 'Seller';
        var body = { relatedParty: [{id: userName, role: role}]};

        // Call the method
        var req = {
            method: 'POST',
            apiUrl: offeringPath,
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
        testCreateProduct(storeValidatorOk, 403, INVALID_USER_CREATE, false,  done);
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

    var testCreateCategory = function(admin, category, categoriesRequest, errorStatus, errorMsg, done) {

        var checkRoleMethod = jasmine.createSpy();
        checkRoleMethod.and.returnValues(admin);

        var utils = {
            validateLoggedIn: validateLoggedOk,
            hasRole: checkRoleMethod
        };

        var catalogApi = getCatalogApi({}, {}, utils);

        // Basic properties
        var userName = 'test';
        var protocol = config.appSsl ? 'https' : 'http';
        var url = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;
        var catalogPath = '/catalog/category';

        // Call the method
        var req = {
            method: 'POST',
            apiUrl: catalogPath,
            user: {
                id: userName,
                roles: [{ name: config.oauth2.roles.seller }]
            },
            body: JSON.stringify(category)
        };

        // Mock server used by the proxy to check if there are another category with the same properties
        if (categoriesRequest) {
            nock(url)
                .get(catalogPath + categoriesRequest.query)
                .reply(categoriesRequest.status, categoriesRequest.body);
        }

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

    it('should allow to create category', function(callback) {

        var categoryName = 'example';

        var categoriesRequest = {
            query: '?name=' + categoryName + '&isRoot=true',
            status: 200,
            body: []
        };

        testCreateCategory(true, { name: categoryName }, categoriesRequest, null, null, callback);
    });

    it('should not allow to create category when existing categories cannot be checked', function(callback) {

        var categoryName = 'example';

        var categoriesRequest = {
            query: '?name=' + categoryName + '&isRoot=true',
            status: 500,
            body: 'ERROR'
        };

        testCreateCategory(true, { name: categoryName }, categoriesRequest, 500, CATEGORIES_CANNOT_BE_CHECKED, callback);
    });

    it('should not allow to create root category if there is a root category with the same name', function(callback) {

        var categoryName = 'example';

        var categoriesRequest = {
            query: '?name=' + categoryName + '&isRoot=true',
            status: 200,
            body: [{}]
        };

        testCreateCategory(true, { name: categoryName }, categoriesRequest, 409, CATEGORY_EXISTS, callback);
    });

    it('should not allow to create non-root category if there is another category at the same level with the same name', function(callback) {

        var categoryName = 'example';
        var parentId = 7;

        var categoriesRequest = {
            query: '?name=' + categoryName + '&parentId=' + parentId,
            status: 200,
            body: [{}]
        };

        testCreateCategory(true, { name: categoryName, isRoot: false, parentId: parentId }, categoriesRequest,
            409, CATEGORY_EXISTS, callback);
    });

    it('should not allow non-admin users to create categories', function(callback) {
        testCreateCategory(false, {}, null, 403, 'Only administrators can create categories', callback);
    });

    it('should not allow to create categories when name is not included', function(callback) {
        testCreateCategory(true, { isRoot: true }, null, 400, CATEGORY_NAME_MISSING, callback);
    });

    it('should not allow to create categories when parentId is included for root categories', function(callback) {
        testCreateCategory(true, { parentId: 7, isRoot: true }, null, 400, PARENT_ID_INCLUDED, callback);
    });

    it('should not allow to create categories non-root categories without parent', function(callback) {
        testCreateCategory(true, { isRoot: false }, null, 400, MISSING_PARENT_ID, callback);
    });

    var testCreateCatalog = function (admin, owner, catalog, catalogRequest, errorStatus, errorMsg, done) {

        var checkRoleMethod = jasmine.createSpy();
        checkRoleMethod.and.returnValues(admin);

        var utils = {
            validateLoggedIn: validateLoggedOk,
            hasRole: checkRoleMethod
        };

        var tmfUtils = {
            isOwner: owner ? isOwnerTrue : isOwnerFalse
        };

        var catalogApi = getCatalogApi({}, tmfUtils, utils);

        // Basic properties
        var userName = 'test';
        var protocol = config.appSsl ? 'https' : 'http';
        var url = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;
        var catalogPath = '/DSProductCatalog/api/catalogManagement/v2/catalog';

        // Call the method
        var req = {
            method: 'POST',
            apiUrl: catalogPath,
            user: {
                id: userName,
                roles: [{ name: config.oauth2.roles.seller }]
            },
            body: JSON.stringify(catalog)
        };

        // Mock server used by the proxy to check if there is another catalog with the same name
        if (catalogRequest) {
            nock(url)
                .get(catalogPath + catalogRequest.query)
                .reply(catalogRequest.status, catalogRequest.body);
        }

        catalogApi.checkPermissions(req, function (err) {

            if (!errorStatus && !errorMsg ) {
                expect(err).toBe(null);
            } else {
                expect(err.status).toBe(errorStatus);
                expect(err.message).toBe(errorMsg);

            }

            done();
        });
    };

    it('should allow to create owned catalog', function (callback) {

        var catalogName = 'example';

        var catalogRequest = {
            query: '?name=' + catalogName,
            status: 200,
            body: []
        };

        testCreateCatalog(true, isOwnerTrue, { name: catalogName }, catalogRequest, null, null, callback);
    });

    it('should not allow to create not owned catalog', function (callback) {

        var catalogName = 'example';

        var catalogRequest = {
            query: '?name=' + catalogName,
            status: 200,
            body: []
        };

        testCreateCatalog(true, isOwnerFalse, { name: catalogName }, catalogRequest, null, null, callback);
    });

    it('should not allow to create catalog when existing catalogs cannot be checked', function (callback) {

        var catalogName = 'example';

        var catalogRequest = {
            query: '?name=' + catalogName,
            status: 500,
            body: 'ERROR'
        };

        testCreateCatalog(true, isOwnerFalse, { name: catalogName }, catalogRequest, 500, CATALOG_CANNOT_BE_CHECKED, callback);
    });

    it('should not allow to create catalog if there is a catalog with the same name', function (callback) {

        var catalogName = 'example';

        var catalogRequest = {
            query: '?name=' + catalogName,
            status: 200,
            body: [{}]
        };

        testCreateCatalog(true, isOwnerFalse, { name: catalogName }, catalogRequest, 409, CATALOG_EXISTS, callback);
    });


    //////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////// UPDATE & DELETE //////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////

    // ANY ASSET

    var testUpdate = function(method, requestStatus, isOwnerMethod, done) {

        var checkRoleMethod = jasmine.createSpy();
        checkRoleMethod.and.returnValue(true);

        var tmfUtils = {
            isOwner: isOwnerMethod
        };

        var utils = {
            validateLoggedIn: validateLoggedOk,
            hasRole: checkRoleMethod
        };

        var catalogApi = getCatalogApi({}, tmfUtils, utils);

        var userName = 'test';
        var path = '/catalog/product/1';
        var protocol = config.appSsl ? 'https' : 'http';
        var url = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;
        var role = isOwnerMethod() ? 'Owner': 'Seller';

        // User information is send when the request does not fail
        var bodyOk = { relatedParty: [{id: userName, role: role}]};
        var bodyErr = 'Internal Server Error';
        var returnedBody = requestStatus != 200 ? bodyErr : bodyOk;

        // The mock server that will handle the request
        nock(url)
            .get(path)
            .reply(requestStatus, returnedBody);

        // Call the method
        var req = {
            method: method,
            apiUrl: path,
            user: {
                id: userName,
                roles: []
            },
            body: {}
        };

        catalogApi.checkPermissions(req, function(err) {

            if (isOwnerMethod() && requestStatus === 200) {
                expect(err).toBe(null);
            } else if (requestStatus === 404) {
                expect(err.status).toBe(404);
                expect(err.message).toBe('The required resource does not exist');
            } else if ([200, 404].indexOf(requestStatus) < 0) {
                expect(err.status).toBe(500);
                expect(err.message).toBe(FAILED_TO_RETRIEVE);
            } else {
                expect(err.status).toBe(403);
                expect(err.message).toBe(INVALID_USER_UPDATE);
            }

            done();
        });
    };

    it('should allow to to update (PUT) an owned resource', function(done) {
        testUpdate('PUT', 200, isOwnerTrue, done);
    });

    it('should not allow to update (PUT) a non-owned resource', function(done) {
        testUpdate('PUT', 200, isOwnerFalse, done);
    });

    it('should not allow to update (PUT) a resource that cannot be checked', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('PUT', 500, isOwnerTrue, done);
    });

    it('should not allow to update (PUT) a resource that does not exist', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('PUT', 404, isOwnerTrue, done);
    });

    it('should allow to to update (PATCH) an owned resource', function(done) {
        testUpdate('PATCH', 200, isOwnerTrue, done);
    });

    it('should not allow to update (PATCH) a non-owned resource', function(done) {
        testUpdate('PATCH', 200, isOwnerFalse, done);
    });

    it('should not allow to update (PATCH) a resource that cannot be checked', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('PATCH', 500, isOwnerTrue, done);
    });

    it('should not allow to update (PATCH) a resource that does not exist', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('PATCH', 404, isOwnerTrue, done);
    });

    it('should allow to to delete owned resource', function(done) {
        testUpdate('DELETE', 200, isOwnerTrue, done);
    });

    it('should not allow to delete a non-owned resource', function(done) {
        testUpdate('DELETE', 200, isOwnerFalse, done);
    });

    it('should not allow to delete a resource that cannot be checked', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('DELETE', 500, isOwnerTrue, done);
    });

    it('should not allow to delete a resource that does not exist', function(done) {
        // The value of isOwner does not matter when requestFails is set to true
        testUpdate('DELETE', 404, isOwnerTrue, done);
    });

    // OFFERINGS

    var getProductSpecification = function(path) {
        return {
            // the server will be avoided by the SW
            // The catalog server will be used instead
            href: config.appHost + ':' + config.endpoints.catalog.port + path
        }
    };

    var testUpdateProductOffering = function(offeringBody, productRequestInfo, catalogRequestInfo, expectedErrorStatus,
                                             expectedErrorMsg, done) {

        var checkRoleMethod = jasmine.createSpy();
        checkRoleMethod.and.returnValue(true);

        var defaultErrorMessage = 'Internal Server Error';

        var tmfUtils = {
            isOwner: productRequestInfo.owner ? isOwnerTrue : isOwnerFalse
        };

        var utils = {
            validateLoggedIn: validateLoggedOk,
            hasRole: checkRoleMethod
        };

        var rssClient = {
            rssClient: {
                createProvider: function(userInfo, callback) {
                    callback(null);
                }
            }
        };

        var catalogApi = getCatalogApi({}, tmfUtils, utils, rssClient);

        // Basic properties
        var userName = 'test';
        var catalogPath = '/catalog/8';
        var offeringPath = catalogPath + '/productOffering/1';
        var productPath = productRequestInfo.path || '/productSpecification/7';
        var protocol = config.appSsl ? 'https' : 'http';
        var serverUrl = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;
        
        // HTTP MOCK - OFFERING
        var bodyGetOffering = {
            productSpecification: getProductSpecification(productPath)
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
            apiUrl: offeringPath,
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


    it('should allow to update an owned offering when productSpecification is included but the content does not vary', function(done) {

        var productRequestInfo = {
            requestStatus: 200,
            owner: true,
            lifecycleStatus: 'active',
            path: '/productSpecification/8'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'active'
        };

        var newOffering = JSON.stringify({
            productSpecification: getProductSpecification(productRequestInfo.path)
        });

        testUpdateProductOffering(newOffering, productRequestInfo, catalogRequestInfo, null, null, done);
    });

    it('should not allow to update an owned offering when productSpecification changes', function(done) {
        var productRequestInfo = {
            requestStatus: 200,
            owner: true,
            lifecycleStatus: 'active'
        };

        var catalogRequestInfo = {
            requestStatus: 200,
            lifecycleStatus: 'active'
        };

        testUpdateProductOffering(JSON.stringify({ productSpecification: {} }), productRequestInfo,
            catalogRequestInfo, 403, 'Field productSpecification cannot be modified', done);
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

        testUpdateProductOffering({}, productRequestInfo, catalogRequestInfo, 403, UPDATE_OFFERING_WITH_NON_OWNED_PRODUCT, done);
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

        testUpdateProductOffering({}, productRequestInfo, catalogRequestInfo, 500, INVALID_PRODUCT, done);
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
        testUpdateProductOffering('{ TEST', {}, {}, 400, INVALID_JSON, done);
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

        var checkRoleMethod = jasmine.createSpy();
        checkRoleMethod.and.returnValue(true);

        var defaultErrorMessage = 'Internal Server Error';

        var tmfUtils = {
            isOwner: function () {
                return true;
            }
        };

        var utils = {
            validateLoggedIn: validateLoggedOk,
            hasRole: checkRoleMethod
        }

        var catalogApi = getCatalogApi({}, tmfUtils, utils);

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
            apiUrl: assetPath,
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

        testChangeProductStatus(productBody, offeringsInfo, 400, INVALID_JSON, done);

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

        testChangeProductStatus(productBody, offeringsInfo, 400, OFFERS_NOT_RETIRED_PRODUCT, done);
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

        testChangeProductStatus(productBody, offeringsInfo, 400, OFFERS_NOT_RETIRED_PRODUCT, done);
    });

    it('should not allow to retire a product if the attached offerings cannot be retrieved', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 404,
            offerings: []
        };

        testChangeProductStatus(productBody, offeringsInfo, 500, OFFERINGS_NOT_RETRIEVED, done);

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

        testChangeProductStatus(productBody, offeringsInfo, 400, OFFERS_NOT_OBSOLETE_PRODUCT, done);
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

        testChangeProductStatus(productBody, offeringsInfo, 400, OFFERS_NOT_OBSOLETE_PRODUCT, done);
    });

    it('should not allow to make a product obsolete if the attached offerings cannot be retrieved', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'obsolete'
        });

        var offeringsInfo = {
            requestStatus: 404,
            offerings: []
        };

        testChangeProductStatus(productBody, offeringsInfo, 500, OFFERINGS_NOT_RETRIEVED, done);

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

        testChangeCatalogStatus(productBody, offeringsInfo, 400, INVALID_JSON, done);

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

        testChangeCatalogStatus(productBody, offeringsInfo, 400, OFFERS_NOT_RETIRED_CATALOG, done);
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

        testChangeCatalogStatus(productBody, offeringsInfo, 400, OFFERS_NOT_RETIRED_CATALOG, done);
    });

    it('should not allow to retire a catalog if the attached offerings cannot be retrieved', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'retired'
        });

        var offeringsInfo = {
            requestStatus: 404,
            offerings: []
        };

        testChangeCatalogStatus(productBody, offeringsInfo, 500, OFFERINGS_NOT_RETRIEVED, done);

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

        testChangeCatalogStatus(productBody, offeringsInfo, 400, OFFERS_NOT_OBSOLETE_CATALOG, done);
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

        testChangeCatalogStatus(productBody, offeringsInfo, 400, OFFERS_NOT_OBSOLETE_CATALOG, done);
    });

    it('should not allow to make a catalog obsolete if the attached offerings cannot be retrieved', function(done) {

        var productBody = JSON.stringify({
            lifecycleStatus: 'obsolete'
        });

        var offeringsInfo = {
            requestStatus: 404,
            offerings: []
        };

        testChangeCatalogStatus(productBody, offeringsInfo, 500, OFFERINGS_NOT_RETRIEVED, done);

    });

    // CATEGORIES

    var testUpdateCategory = function(method, admin, oldStateRequest, existingCategoriesRequest, updatedCategory,
                                      errorStatus, errorMessage, done) {

        var checkRoleMethod = jasmine.createSpy();
        checkRoleMethod.and.returnValue(admin);

        var utils = {
            hasRole: checkRoleMethod
        };

        var catalogApi = getCatalogApi({}, {}, utils);

        var userName = 'test';
        var basicPath = '/catalog/category';
        var categoryResourcePath = basicPath + '/7';
        var protocol = config.appSsl ? 'https' : 'http';
        var url = protocol + '://' + config.appHost + ':' + config.endpoints.catalog.port;

        // The mock server that will handle the request to retrieve the old state of the category
        nock(url)
            .get(categoryResourcePath)
            .reply(oldStateRequest.status, JSON.stringify(oldStateRequest.body));

        if (existingCategoriesRequest) {
            // The mock server that will handle the request to retrieve categories with the same properties
            nock(url)
                .get(basicPath + existingCategoriesRequest.query)
                .reply(existingCategoriesRequest.status, JSON.stringify(existingCategoriesRequest.body));
        }

        // Call the method
        var req = {
            method: method,
            apiUrl: categoryResourcePath,
            user: {
                id: userName,
                roles: []
            },
            body: JSON.stringify(updatedCategory)
        };

        catalogApi.checkPermissions(req, function(err) {

            if (errorStatus && errorMessage) {
                expect(err.status).toBe(errorStatus);
                expect(err.message).toBe(errorMessage);
            } else {
                expect(err).toBe(null);
            }

            done();
        });
    };

    it('should allow to delete category when admin', function(done) {
        testUpdateCategory('DELETE', true, { status: 200, body: { } }, null, null, null, null, done);
    });

    it('should not allow to delete category when no admin', function(done) {
        testUpdateCategory('DELETE', false, { status: 200, body: {} }, null, null, 403,
            ONLY_ADMINS_MODIFY_CATEGORIES, done);
    });

    it('should not allow to delete category when category cannot be retrieved', function(done) {
        testUpdateCategory('DELETE', false, { status: 500, body: {} }, null, null, 500,
            FAILED_TO_RETRIEVE, done);
    });

    it('should allow to update description of a category when admin', function(done) {

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: true } }, null,
            { description: 'another-description' }, null, null, done);
    });

    it('should allow to update name of a root category when admin', function(done) {

        var categoryName = 'valid';

        var categoriesRequest = {
            query: '?name=' + categoryName + '&isRoot=true',
            status: 200,
            body: []
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: true } }, categoriesRequest,
            { name: categoryName }, null, null, done);
    });

    it('should allow to update a category when fields include but they do not change', function(done) {

        var category = { name: 'valid', isRoot: false, parentId: 7 };

        testUpdateCategory('PATCH', true, { status: 200, body: category }, null, category, null, null, done);
    });

    it('should not allow to update name of a root category when admin and there are another category with the ' +
            'same name', function(done) {

        var categoryName = 'valid';

        var categoriesRequest = {
            query: '?name=' + categoryName + '&isRoot=true',
            status: 200,
            body: [{}]
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: true } }, categoriesRequest,
            { name: categoryName }, 409, CATEGORY_EXISTS, done);
    });


    it('should not allow to update name of a root category when admin and existing categories cannot be retrieved', function(done) {

        var categoryName = 'valid';

        var categoriesRequest = {
            query: '?name=' + categoryName + '&isRoot=true',
            status: 500,
            body: []
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: true } }, categoriesRequest,
            { name: categoryName }, 500, CATEGORIES_CANNOT_BE_CHECKED, done);
    });

    it('should allow to update name of a non-root category when admin', function(done) {

        var categoryName = 'correct';
        var parentId = 7;

        var categoriesRequest = {
            query: '?name=' + categoryName + '&parentId=' + parentId,
            status: 200,
            body: []
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: false, parentId: parentId } },
            categoriesRequest, { name: categoryName }, null, null, done);
    });

    it('should not allow to update name of a non-root category when admin and there are another category with ' +
            'the same name', function(done) {

        var categoryName = 'correct';
        var parentId = 7;

        var categoriesRequest = {
            query: '?name=' + categoryName + '&parentId=' + parentId,
            status: 200,
            body: [{}]
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: false, parentId: parentId } },
            categoriesRequest, { name: categoryName }, 409, CATEGORY_EXISTS, done);
    });

    it('should not allow to update name of a non-root category when admin and existing categories cannot ' +
            'be retrieved', function(done) {

        var categoryName = 'correct';
        var parentId = 7;

        var categoriesRequest = {
            query: '?name=' + categoryName + '&parentId=' + parentId,
            status: 500,
            body: []
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: false, parentId: parentId } },
            categoriesRequest, { name: categoryName }, 500, CATEGORIES_CANNOT_BE_CHECKED, done);
    });

    it('should not allow to update category when no admin', function(done) {

        testUpdateCategory('PATCH', false, { status: 200, body: { name: 'invalid', isRoot: true } }, null,
            { name: 'correct' }, 403, ONLY_ADMINS_MODIFY_CATEGORIES, done);
    });

    it('should not allow to update category when category cannot be retrieved', function(done) {

        testUpdateCategory('PATCH', true, { status: 500, body: null }, null, { name: 'correct' }, 500,
            FAILED_TO_RETRIEVE, done);
    });

    it('should not allow to update category when trying to remove parent ID', function(done) {

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: false, parentId: 9 } }, null,
            { name: 'correct', parentId: null }, 400, MISSING_PARENT_ID, done);
    });

    it('should not allow to update category when setting it as non-root without parent', function(done) {

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid' } }, null,
            { name: 'correct', isRoot: false }, 400, MISSING_PARENT_ID, done);
    });

    it('should allow to update category when setting it as non-root and parent already set', function(done) {

        var categoryName = 'correct';
        var parentId = 7;

        var categoriesRequest = {
            query: '?name=' + categoryName + '&parentId=' + parentId,
            status: 200,
            body: []
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', parentId: parentId } },
            categoriesRequest, { name: categoryName, isRoot: false }, null, null, done);
    });

    it('should not allow to update category when setting it as non-root and parent already set and another category ' +
            'with the same properties exists', function(done) {

        var categoryName = 'correct';
        var parentId = 7;

        var categoriesRequest = {
            query: '?name=' + categoryName + '&parentId=' + parentId,
            status: 200,
            body: [{}]
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', parentId: parentId } },
            categoriesRequest, { name: categoryName, isRoot: false }, 409, CATEGORY_EXISTS, done);
    });

    it('should not allow to update category when setting it as non-root and parent already set and existing ' +
            'categories cannot be retrieved', function(done) {

        var categoryName = 'correct';
        var parentId = 7;

        var categoriesRequest = {
            query: '?name=' + categoryName + '&parentId=' + parentId,
            status: 500,
            body: []
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', parentId: parentId } },
            categoriesRequest, { name: categoryName, isRoot: false }, 500, CATEGORIES_CANNOT_BE_CHECKED, done);
    });

    it('should not allow to update category when setting it as root category and parent specified', function(done) {
        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid'} }, null,
            { name: 'correct', isRoot: true, parentId: 7 }, 400, PARENT_ID_INCLUDED, done);
    });

    it('should not allow to update category when setting it as root category and parent specified #2', function(done) {

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: false, parentId: 7 } },
            null, { name: 'correct', isRoot: true }, 400, PARENT_ID_INCLUDED, done);
    });

    it('should allow to update category when setting it as root category and parent removed', function(done) {

        var categoryName = 'correct';

        var categoriesRequest = {
            query: '?name=' + categoryName + '&isRoot=true',
            status: 200,
            body: []
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: false, parentId: 7 } },
            categoriesRequest, { name: categoryName, isRoot: true, parentId: null }, null, null, done);
    });

    it('should not allow to update category when setting it as root category and parent removed and another ' +
            'root category with the same name exists', function(done) {

        var categoryName = 'correct';

        var categoriesRequest = {
            query: '?name=' + categoryName + '&isRoot=true',
            status: 200,
            body: [{}]
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: false, parentId: 7 } },
            categoriesRequest, { name: categoryName, isRoot: true, parentId: null }, 409, CATEGORY_EXISTS, done);
    });

    it('should not allow to update category when setting it as root category and parent removed and existing ' +
            'categories cannot be retrieved', function(done) {

        var categoryName = 'correct';

        var categoriesRequest = {
            query: '?name=' + categoryName + '&isRoot=true',
            status: 500,
            body: []
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: false, parentId: 7 } },
            categoriesRequest, { name: categoryName, isRoot: true, parentId: null }, 500, CATEGORIES_CANNOT_BE_CHECKED,
            done);
    });

    it('should not allow to update category when adding parent to a root category', function(done) {
        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: true } }, null,
            { name: 'correct', parentId: 7 }, 400, PARENT_ID_INCLUDED, done);
    });

    it('should allow to update category when adding parent to a root category and setting it as non-root', function(done) {

        var categoryName = 'correct';
        var parentId = 7;

        var categoriesRequest = {
            query: '?name=' + categoryName + '&parentId=' + parentId,
            status: 200,
            body: []
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: true } }, categoriesRequest,
            { name: categoryName, parentId: parentId, isRoot: false }, null, null, done);
    });

    it('should not allow to update category when adding parent to a root category and setting it as non-root and ' +
            'there is already a category with the same properties', function(done) {

        var categoryName = 'correct';
        var parentId = 7;

        var categoriesRequest = {
            query: '?name=' + categoryName + '&parentId=' + parentId,
            status: 200,
            body: [{}]
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: true } }, categoriesRequest,
            { name: categoryName, parentId: parentId, isRoot: false }, 409, CATEGORY_EXISTS, done);
    });

    it('should not allow to update category when adding parent to a root category and setting it as non-root and ' +
            'existing categories cannot be retrieved', function(done) {

        var categoryName = 'correct';
        var parentId = 7;

        var categoriesRequest = {
            query: '?name=' + categoryName + '&parentId=' + parentId,
            status: 500,
            body: []
        };

        testUpdateCategory('PATCH', true, { status: 200, body: { name: 'invalid', isRoot: true } }, categoriesRequest,
            { name: categoryName, parentId: parentId, isRoot: false }, 500, CATEGORIES_CANNOT_BE_CHECKED, done);
    });

});