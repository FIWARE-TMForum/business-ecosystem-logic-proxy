/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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

const deepcopy = require('deepcopy');
const nock = require('nock');
const proxyquire = require('proxyquire');
const md5 = require('blueimp-md5');
const testUtils = require('../../utils');

// ERRORS
const INVALID_METHOD = 'The HTTP method DELETE is not allowed in the accessed API';
const INVALID_METHOD_PUT = 'The HTTP method PUT is not allowed in the accessed API';
const PARENT_ID_INCLUDED = 'Parent ID cannot be included when the category is root';
const MISSING_PARENT_ID = 'Non-root categories must contain a parent category';
const FAILED_TO_RETRIEVE = 'The TMForum APIs fails to retrieve the object you are trying to update/delete';
const NEED_AUTHENTICATION = 'You need to be authenticated to create/update/delete resources';
const INVALID_JSON = 'The provided body is not a valid JSON';
const CREATE_OFFERING_FOR_NON_OWNED_PRODUCT = 'You are not allowed to create offerings for products you do not own';
const UPDATE_OFFERING_WITH_NON_OWNED_PRODUCT = 'You are not allowed to update offerings for products you do not own';
const INVALID_PRODUCT = 'The attached product cannot be read or does not exist';
const INVALID_USER_CREATE = 'The user making the request and the specified owner are not the same user';
const INVALID_USER_UPDATE = 'The user making the request is not the owner of the accessed resource';
const OFFERS_NOT_RETIRED_PRODUCT = 'All the attached offerings must be retired or obsolete to retire a product';
const OFFERS_NOT_RETIRED_CATALOG = 'All the attached offerings must be retired or obsolete to retire a catalog';
const OFFERS_NOT_OBSOLETE_PRODUCT = 'All the attached offerings must be obsolete to make a product obsolete';
const OFFERS_NOT_OBSOLETE_CATALOG = 'All the attached offerings must be obsolete to make a catalog obsolete';
const ONLY_ADMINS_MODIFY_CATEGORIES = 'Only administrators can modify categories';
const OFFERINGS_NOT_RETRIEVED = 'Attached offerings cannot be retrieved';
const CATEGORY_EXISTS = 'This category already exists';
const CATEGORIES_CANNOT_BE_CHECKED = 'It was impossible to check if the provided category already exists';
const CATEGORY_NAME_MISSING = 'Category name is mandatory';
const CATALOG_CANNOT_BE_CHECKED = 'It was impossible to check if there is another catalog with the same name';
const CATALOG_EXISTS = 'This catalog name is already taken';
const RSS_CANNOT_BE_ACCESSED = 'An unexpected error in the RSS API prevented your request to be processed';
const INVALID_PRODUCT_CLASS = 'The provided productClass does not specify a valid revenue sharing model';
const MISSING_PRODUCT_SPEC = 'Product offerings must contain a productSpecification';
const MISSING_HREF_PRODUCT_SPEC = 'Missing required field href in product specification';
const BUNDLED_OFFERING_NOT_BUNDLE = 'Product offerings which are not a bundle cannot contain a bundled product offering';
const INVALID_BUNDLE_WITH_PRODUCT = 'Product offering bundles cannot contain a product specification';
const INVALID_BUNDLE_MISSING_OFF = 'Product offering bundles must contain at least two bundled offerings';
const INVALID_BUNDLE_STATUS =
	'It is not allowed to update bundle related attributes (isBundle, bundledProductSpecification) in launched products';
const INVALID_BUNDLE_MISSING_OFF_HREF = 'Missing required field href in bundled offering';
const OFF_BUNDLE_FAILED_TO_RETRIEVE = 'The bundled offering 2 cannot be accessed or does not exists';
const OFF_BUNDLE_IN_BUNDLE = 'Product offering bundles cannot include another bundle';
const UNAUTHORIZED_OFF_BUNDLE = 'You are not allowed to bundle offerings you do not own';
const MISSING_BUNDLE_PRODUCTS = 'Product spec bundles must contain at least two bundled product specs';
const MISSING_HREF_BUNDLE_INFO = 'Missing required field href in bundleProductSpecification';
const UNAUTHORIZED_BUNDLE = 'You are not authorized to include the product spec 3 in a product spec bundle';
const BUNDLE_INSIDE_BUNDLE = 'It is not possible to include a product spec bundle in another product spec bundle';
const INVALID_BUNDLED_PRODUCT_STATUS = 'Only Active or Launched product specs can be included in a bundle';
const INVALID_RELATED_PARTY = 'The field "relatedParty" can not be modified';
const INVALID_CATEGORY_ID = 'Invalid category with id: ';
const CATEGORY_CANNOT_BE_CHECKED = ['It was impossible to check if the category with id: ', ' already exists'];

const UPGRADE_ASSET_NOT_PROVIDED = 'To upgrade product specifications it is required to provide new asset info';
const UPGRADE_VERSION_NOT_PROVIDED = 'Product specification characteristics only can be updated for upgrading digital products';
const UPGRADE_CUSTOM_CHAR_MOD = 'It is not allowed to update custom characteristics during a product upgrade';
const INVALID_NON_DIGITAL_UPGRADE = 'Product spec characteristics cannot be updated';

describe('Catalog API', function() {
	var config = testUtils.getDefaultConfig();
	const basepath = '/catalog'
	var getCatalogApi = function(storeClient, tmfUtils, utils, rssClient, indexes, async) {
		if (!rssClient) {
			rssClient = {};
		}

		if (!indexes) {
			indexes = {};
		}

		if (!async) {
			async = {};
		}
		
		// load config depending on utils
		return proxyquire('../../../controllers/tmf-apis/catalog', {
			'./../../config': config,
			'./../../lib/logger': testUtils.emptyLogger,
			'./../../lib/store': storeClient,
			'./../../lib/rss': rssClient,
			'./../../lib/tmfUtils': tmfUtils,
			'./../../lib/utils': utils,
			'./../../lib/indexes': {indexes},
			async: async
		}).catalog;
	};

	beforeEach(function() {
		nock.cleanAll();
	});

	/// ///////////////////////////////////////////////////////////////////////////////////////////
	/// ////////////////////////////////////////// GET ////////////////////////////////////////////
	/// ///////////////////////////////////////////////////////////////////////////////////////////

	it('should call OK callback on GET requests', function(done) {
		var catalogApi = getCatalogApi({}, {}, {});

		var req = {
			method: 'GET'
			// user: { roles: [] }
		};

		catalogApi.checkPermissions(req, function() {
			// Callback function. It's called without arguments...
			done();
		});
	});

	/// ///////////////////////////////////////////////////////////////////////////////////////////
	/// /////////////////////////////////// NOT AUTHENTICATED /////////////////////////////////////
	/// ///////////////////////////////////////////////////////////////////////////////////////////

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

	it('should reject not authenticated PATCH requests', function(done) {
		testNotLoggedIn('PATCH', done);
	});

	it('should reject not authenticated DELETE requests', function(done) {
		testNotLoggedIn('DELETE', done);
	});

	it('should reject PUT requests', function(done) {
		var catalogApi = getCatalogApi({}, {}, {});
		var path = '/catalog/product/1';

		// Call the method
		var req = {
			method: 'PUT',
			apiUrl: path
		};

		catalogApi.checkPermissions(req, function(err) {
			expect(err).not.toBe(null);
			expect(err.status).toBe(405);
			expect(err.message).toBe(INVALID_METHOD_PUT);

			done();
		});
	});

	/// ///////////////////////////////////////////////////////////////////////////////////////////
	/// //////////////////////////////////////// CREATE ///////////////////////////////////////////
	/// ///////////////////////////////////////////////////////////////////////////////////////////

	var validateLoggedOk = function(req, callback) {
		callback();
	};

	var isOwnerFalse = function(userInfo, info) {
		return false;
	};

	var isOwnerTrue = function(userInfo, info) {
		return true;
	};

	var SERVER =
		(config.endpoints.catalog.appSsl ? 'https' : 'http') +
		'://' +
		config.endpoints.catalog.host +
		':' +
		config.endpoints.catalog.port;

	var mockBundles = function(bundles) {
		var productPath = '/productSpecification/';

		// Mock bundles
		var body = {
			validFor: {
				startDateTime: '2019-06-10'
			},
			isBundle: true,
			bundledProductSpecification: []
		};

		for (var i = 0; i < bundles.length; i++) {
			if (bundles[i].id) {
				body.bundledProductSpecification.push({
					href: SERVER + productPath + bundles[i].id,
					id: bundles[i].id
				});

				if (bundles[i].body) {
					nock(SERVER)
						.get(productPath + bundles[i].id)
						.reply(bundles[i].status, bundles[i].body);
				}
			} else {
				body.bundledProductSpecification.push({});
			}
		}

		return body;
	};

	var testCreateBasic = function(
		user,
		body,
		roles,
		error,
		expectedStatus,
		expectedErr,
		isSeller,
		sellerChecked,
		owner,
		done
	) {
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

	var basicBody = {
		validFor: {
			startDateTime: '2016-07-12T10:56:00'
		}
	};

	it('should reject creation requests with invalid JSON', function(done) {
		testCreateBasic('test', '{', [], true, 400, INVALID_JSON, true, false, true, done);
	});

	it('should reject creation requests when user has not the seller role', function(done) {
		testCreateBasic(
			'test',
			JSON.stringify(basicBody),
			[],
			true,
			403,
			'You are not authorized to create resources',
			false,
			true,
			false,
			done
		);
	});

	//DEPRECATED
//-------------------------------------------------------------------------------------------------------------
	
	// it('should reject creation requests when related party role is not owner', function(done) { 
		// 	var user = 'test';
		// 	var resource = {
			// 		relatedParty: [{ name: user, role: 'invalid role' }],
			// 		validFor: basicBody.validFor
			// 	};
			
			// 	testCreateBasic(
				// 		user,
				// 		JSON.stringify(resource),
				// 		[{ name: config.oauth2.roles.seller }],
				// 		true,
				// 		403,
				// 		INVALID_USER_CREATE,
				// 		true,
				// 		true,
				// 		false,
				// 		done
				// 	);
				// });
//-------------------------------------------------------------------------------------------------------------

	it('should allow to create resources when user is seller', function(done) {
		var user = 'test';
		var resource = {
			relatedParty: [{ id: user, role: 'OwNeR' }],
			validFor: basicBody.validFor
		};

		// Error parameters are not required when the resource can be created
		testCreateBasic(
			user,
			JSON.stringify(resource),
			[{ name: config.oauth2.roles.seller }],
			false,
			null,
			null,
			true,
			true,
			true,
			done
		);
	});

	describe('Offering creation', function() {
		// Basic properties
		var userName = 'test';
		var catalogPath = '/catalog/7';
		var offeringPath = '/catalog'+catalogPath + '/productOffering';
		var protocol = config.endpoints.catalog.appSsl ? 'https' : 'http';
		var serverUrl = protocol + '://' + config.endpoints.catalog.host + ':' + config.endpoints.catalog.port;
		var productPath = '/productSpecification/7';
		var categoryPath = '/category';

		var user = {
			partyId: userName,
			roles: [{ name: config.oauth2.roles.seller }]
		};

		var basicBody = {
			productSpecification: {
				// the server will be avoided by the SW
				// The catalog server will be used instead
				id: 7
			},
			serviceCandidate: {
				id: 'productClass'
			},
			validFor: {
				startDateTime: '2016-05-01'
			}
		};

		var productRequestInfoActive = {
			requestStatus: 200,
			role: 'Owner',
			lifecycleStatus: 'active'
		};

		var catalogRequestInfoLaunched = {
			requestStatus: 200,
			lifecycleStatus: 'launched'
		};

		var mockCatalogAPI = function(body, requestInfo, storeError, rssResp) {
			// Mocks
			var checkRoleMethod = jasmine.createSpy();
			checkRoleMethod.and.returnValue(true);

			var tmfUtils = {
				isOwner: requestInfo.role.toLowerCase() === 'owner' ? isOwnerTrue : isOwnerFalse
			};

			var utils = {
				validateLoggedIn: validateLoggedOk,
				hasRole: checkRoleMethod
			};

			var storeClient = {
				storeClient: {
					validateOffering: function(offeringInfo, userInfo, callback) {
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

			return getCatalogApi(storeClient, tmfUtils, utils, rssClient);
		};

		var mockCatalogService = function(catalogRequestInfo, defaultErrorMessage) {
			// The mock server that will handle the request when the catalog is requested
			var bodyGetCatalogOk = { lifecycleStatus: catalogRequestInfo.lifecycleStatus };
			var bodyGetCatalog = catalogRequestInfo.requestStatus === 200 ? bodyGetCatalogOk : defaultErrorMessage;

			nock(serverUrl)
				.get(catalogPath)
				.reply(catalogRequestInfo.requestStatus, bodyGetCatalog);
		};

		var executeCheckPermissionsTest = function(body, catalogApi, errorStatus, errorMsg, done) {
			var req = {
				method: 'POST',
				apiUrl: offeringPath,
				user: user,
				body: JSON.stringify(body),
				headers: {}
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

		var testCreateOffering = function(
			productRequestInfo,
			catalogRequestInfo,
			categoriesRequestInfo,
			storeError,
			errorStatus,
			errorMsg,
			rssResp,
			body,
			done
		) {
			var defaultErrorMessage = 'Internal Server Error';
			var catalogApi = mockCatalogAPI(body, productRequestInfo, storeError, rssResp);

			// The mock server that will handle the request when the product is requested
			var bodyGetProductOk = {
				relatedParty: [{ id: userName, role: productRequestInfo.role }],
				lifecycleStatus: productRequestInfo.lifecycleStatus
			};
			var bodyGetProduct = productRequestInfo.requestStatus === 200 ? bodyGetProductOk : defaultErrorMessage;

			if (body.category) {
				var categories = body.category;

				for (var i = 0; i < categories.length; i++) {
					nock(serverUrl)
						.get(categoryPath + '/' + categories[i].id)
						.reply(categoriesRequestInfo[categories[i].id].requestStatus, {});
				}
			}

			nock(serverUrl)
				.get(productPath)
				.reply(productRequestInfo.requestStatus, bodyGetProduct);

			mockCatalogService(catalogRequestInfo, defaultErrorMessage);

			// Call the method
			executeCheckPermissionsTest(body, catalogApi, errorStatus, errorMsg, done);
		};

		it('should allow to create an offering with an owned product', function(done) {
			testCreateOffering(
				productRequestInfoActive,
				catalogRequestInfoLaunched,
				null,
				null,
				null,
				null,
				null,
				basicBody,
				done
			);
		});

		it('should not allow to create an offering when store validation fails', function(done) {
			var storeResponse = {
				status: 400,
				message: 'Invalid pricing'
			};

			testCreateOffering(
				productRequestInfoActive,
				catalogRequestInfoLaunched,
				null,
				storeResponse,
				storeResponse.status,
				storeResponse.message,
				null,
				basicBody,
				done
			);
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

			testCreateOffering(
				productRequestInfo,
				catalogRequestInfo,
				null,
				null,
				403,
				CREATE_OFFERING_FOR_NON_OWNED_PRODUCT,
				null,
				basicBody,
				done
			);
		});

		it('should not allow to create an offering in a retired catalogue', function(done) {
			var catalogRequestInfo = {
				requestStatus: 200,
				lifecycleStatus: 'retired'
			};

			testCreateOffering(
				productRequestInfoActive,
				catalogRequestInfo,
				null,
				null,
				400,
				'Offerings can only be created in a ' + 'catalog that is active or launched',
				null,
				basicBody,
				done
			);
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

			testCreateOffering(
				productRequestInfo,
				catalogRequestInfo,
				null,
				null,
				400,
				'Offerings can only be attached to ' + 'active or launched products',
				null,
				basicBody,
				done
			);
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

			testCreateOffering(
				productRequestInfo,
				catalogRequestInfo,
				null,
				null,
				422,
				INVALID_PRODUCT,
				null,
				basicBody,
				done
			);
		});

		it('should not allow to create an offering when the attached catalog cannot be retrieved', function(done) {
			var catalogRequestInfo = {
				requestStatus: 500,
				lifecycleStatus: 'active'
			};

			// isOwner does not matter when productRequestFails is set to true
			testCreateOffering(
				productRequestInfoActive,
				catalogRequestInfo,
				null,
				null,
				500,
				'The catalog attached to the offering ' + 'cannot be read',
				null,
				basicBody,
				done
			);
		});

		it('should not allow to create an offering when the productSpecification field has not been provided', function(done) {
			testCreateOffering(
				productRequestInfoActive,
				catalogRequestInfoLaunched,
				null,
				null,
				422,
				MISSING_PRODUCT_SPEC,
				null,
				{},
				done
			);
		});

		it('should not allow to create an offering when a bundled offering is provided and not a bundle', function(done) {
			var offeringBody = {
				productSpecification: {
					href: 'http://product.com'
				},
				bundledProductOffering: [{}]
			};
			testCreateOffering(
				productRequestInfoActive,
				catalogRequestInfoLaunched,
				null,
				null,
				422,
				BUNDLED_OFFERING_NOT_BUNDLE,
				null,
				offeringBody,
				done
			);
		});

		// it('should not allow to create an offering when it is no possible to check the offering categories', function(done) {
		// 	var categoryId1 = '7';
		// 	var categoryId2 = '8';
		// 	var baseHref = 'http://example' + categoryPath + '/';

		// 	var offeringBody = {
		// 		category: [
		// 			{
		// 				id: categoryId1,
		// 				href: baseHref + categoryId1
		// 			},
		// 			{
		// 				id: categoryId2,
		// 				href: baseHref + categoryId2
		// 			}
		// 		]
		// 	};

		// 	var categoriesRequestInfo = {};
		// 	categoriesRequestInfo[categoryId1] = { requestStatus: 200 };
		// 	categoriesRequestInfo[categoryId2] = { requestStatus: 500 };

		// 	var errorMsg = CATEGORY_CANNOT_BE_CHECKED[0] + categoryId2 + CATEGORY_CANNOT_BE_CHECKED[1];

		// 	testCreateOffering(
		// 		productRequestInfoActive,
		// 		catalogRequestInfoLaunched,
		// 		categoriesRequestInfo,
		// 		null,
		// 		500,
		// 		errorMsg,
		// 		null,
		// 		offeringBody,
		// 		done
		// 	);
		// });

		// it('should not allow to create an offering when at least one offering category is not a valid category', function(done) {
		// 	var categoryId1 = '7';
		// 	var categoryId2 = '8';
		// 	var baseHref = 'http://example' + categoryPath + '/';

		// 	var offeringBody = {
		// 		category: [
		// 			{
		// 				id: categoryId1,
		// 				href: baseHref + categoryId1
		// 			},
		// 			{
		// 				id: categoryId2,
		// 				href: baseHref + categoryId2
		// 			}
		// 		]
		// 	};

		// 	var categoriesRequestInfo = {};
		// 	categoriesRequestInfo[categoryId1] = { requestStatus: 200 };
		// 	categoriesRequestInfo[categoryId2] = { requestStatus: 404 };

		// 	var errorMsg = INVALID_CATEGORY_ID + categoryId2;

		// 	testCreateOffering(
		// 		productRequestInfoActive,
		// 		catalogRequestInfoLaunched,
		// 		categoriesRequestInfo,
		// 		null,
		// 		400,
		// 		errorMsg,
		// 		null,
		// 		offeringBody,
		// 		done
		// 	);
		// });

		var testCreateOfferingBundle = function(
			offeringRequestInfo,
			catalogRequestInfo,
			storeError,
			body,
			errorStatus,
			errorMsg,
			done
		) {
			var defaultErrorMessage = 'Internal Server Error';

			// Mock date
			var fakeDate = function() {
				this.toISOString = function() {
					return '2016-05-01';
				};
			};

			
			var expBody = deepcopy(body);
			expBody.validFor = {
				startDateTime: '2016-05-01'
			};
			
			var catalogApi = mockCatalogAPI(expBody, offeringRequestInfo, storeError, null);
			
			spyOn(global, 'Date').and.callFake(function() {
				return new fakeDate();
			});

			var productSpecificationOk = {
				relatedParty: [{ id: userName, role: offeringRequestInfo.role }]
			};

			var bodyGetProduct =
				offeringRequestInfo.productRequestStatus === 200 ? productSpecificationOk : defaultErrorMessage;

			for (var i = 0; i < offeringRequestInfo.hrefs.length; i++) {
				// The mock server that will handle the request when the product is requested
				var bodyGetOfferingOk = {
					isBundle: offeringRequestInfo.isBundle,
					lifecycleStatus: offeringRequestInfo.lifecycleStatus,
					productSpecification: {
						id: (() => {
							const array =offeringRequestInfo.products[i].split('/')
							return array[array.length-1]
						})(),
						href: serverUrl + offeringRequestInfo.products[i]
					}
				};
				var bodyGetOffering =
					offeringRequestInfo.requestStatus === 200 ? bodyGetOfferingOk : defaultErrorMessage;

				nock(serverUrl)
					.get(offeringRequestInfo.products[i])
					.reply(offeringRequestInfo.productRequestStatus, bodyGetProduct);

				nock(serverUrl)
					.get(offeringRequestInfo.hrefs[i])
					.reply(offeringRequestInfo.requestStatus, bodyGetOffering);
			}

			mockCatalogService(catalogRequestInfo, defaultErrorMessage);
			// Call the method
			executeCheckPermissionsTest(body, catalogApi, errorStatus, errorMsg, done);
		};

		var offering1 = catalogPath + '/productOffering/1';
		var offering2 = catalogPath + '/productOffering/2';
		var product1 = '/productSpecification/20';
		var product2 = '/productSpecification/21';

		it('should allow to create an offering bundle', function(done) {
			var body = {
				isBundle: true,
				bundledProductOffering: [
					{
						href: serverUrl + offering1
					},
					{
						href: serverUrl + offering2
					}
				],
				serviceCandidate: { id: 'defaultRevenue', name: 'Revenue Sharing Service' }
			};

			var offeringRequestInfo = {
				role: 'Owner',
				isBundle: false,
				lifecycleStatus: 'active',
				hrefs: [offering1, offering2],
				products: [product1, product2],
				requestStatus: 200,
				productRequestStatus: 200
			};
			testCreateOfferingBundle(offeringRequestInfo, catalogRequestInfoLaunched, null, body, null, null, done);
		});

		it('should not allow to create an offering bundle with a productSpecification', function(done) {
			var body = {
				isBundle: true,
				productSpecification: {
					id: '1'
				}
			};

			var offeringRequestInfo = {
				role: 'Owner',
				isBundle: false,
				lifecycleStatus: 'active',
				hrefs: [],
				products: [],
				requestStatus: 200,
				productRequestStatus: 200
			};

			testCreateOfferingBundle(
				offeringRequestInfo,
				catalogRequestInfoLaunched,
				null,
				body,
				422,
				INVALID_BUNDLE_WITH_PRODUCT,
				done
			);
		});

		it('should not allow to create an offering bundle when less than 2 bundled offerings has been provided', function(done) {
			var body = {
				isBundle: true
			};

			var offeringRequestInfo = {
				role: 'Owner',
				isBundle: false,
				lifecycleStatus: 'active',
				hrefs: [],
				products: [],
				requestStatus: 200,
				productRequestStatus: 200
			};

			testCreateOfferingBundle(
				offeringRequestInfo,
				catalogRequestInfoLaunched,
				null,
				body,
				422,
				INVALID_BUNDLE_MISSING_OFF,
				done
			);
		});

		it('should not allow to create an offering bundle when there is missing an href in the bundled offering info', function(done) {
			var body = {
				isBundle: true,
				bundledProductOffering: [
					{},
					{}
				]
			};

			var offeringRequestInfo = {
				role: 'Owner',
				isBundle: false,
				lifecycleStatus: 'active',
				hrefs: [],
				products: [],
				requestStatus: 200,
				productRequestStatus: 200
			};

			testCreateOfferingBundle(
				offeringRequestInfo,
				catalogRequestInfoLaunched,
				null,
				body,
				422,
				INVALID_BUNDLE_MISSING_OFF_HREF,
				done
			);
		});

		it('should not allow to create an offering bundle when a bundled offering cannot be accessed', function(done) {
			var body = {
				isBundle: true,
				bundledProductOffering: [
					{
						id: '2',
						href: serverUrl + offering1
					},
					{
						id: '2',
						href: serverUrl + offering2
					}
				]
			};

			var offeringRequestInfo = {
				role: 'Owner',
				isBundle: false,
				lifecycleStatus: 'active',
				hrefs: [offering1, offering2],
				products: [product1, product2],
				requestStatus: 500,
				productRequestStatus: 200
			};
			testCreateOfferingBundle(
				offeringRequestInfo,
				catalogRequestInfoLaunched,
				null,
				body,
				422,
				OFF_BUNDLE_FAILED_TO_RETRIEVE,
				done
			);
		});

		it('should not allow to create an offering bundle when a bundled offering is also a bundle', function(done) {
			var body = {
				isBundle: true,
				bundledProductOffering: [
					{
						href: serverUrl + offering1
					},
					{
						href: serverUrl + offering2
					}
				]
			};

			var offeringRequestInfo = {
				role: 'Owner',
				isBundle: true,
				lifecycleStatus: 'active',
				hrefs: [offering1, offering2],
				products: [product1, product2],
				requestStatus: 200,
				productRequestStatus: 200
			};
			testCreateOfferingBundle(
				offeringRequestInfo,
				catalogRequestInfoLaunched,
				null,
				body,
				422,
				OFF_BUNDLE_IN_BUNDLE,
				done
			);
		});

		it('should not allow to create a bundle with a non owned offering', function(done) {
			var body = {
				isBundle: true,
				bundledProductOffering: [
					{
						href: serverUrl + offering1
					},
					{
						href: serverUrl + offering2
					}
				]
			};

			var offeringRequestInfo = {
				role: 'seller',
				isBundle: false,
				lifecycleStatus: 'active',
				hrefs: [offering1, offering2],
				products: [product1, product2],
				requestStatus: 200,
				productRequestStatus: 200
			};
			testCreateOfferingBundle(
				offeringRequestInfo,
				catalogRequestInfoLaunched,
				null,
				body,
				403,
				UNAUTHORIZED_OFF_BUNDLE,
				done
			);
		});

		it('should not allow to create a bundle when bundled offering product cannot be accessed', function(done) {
			var body = {
				isBundle: true,
				bundledProductOffering: [
					{
						href: serverUrl + offering1
					},
					{
						href: serverUrl + offering2
					}
				]
			};

			var offeringRequestInfo = {
				role: 'Owner',
				isBundle: false,
				lifecycleStatus: 'active',
				hrefs: [offering1, offering2],
				products: [product1, product2],
				requestStatus: 200,
				productRequestStatus: 500
			};
			testCreateOfferingBundle(
				offeringRequestInfo,
				catalogRequestInfoLaunched,
				null,
				body,
				403,
				UNAUTHORIZED_OFF_BUNDLE,
				done
			);
		});
	});

	describe('Create product', function() {
		var mockCatalogAPI = function(isOwner, storeValidator) {
			var checkRoleMethod = jasmine.createSpy();
			checkRoleMethod.and.returnValue(true);

			// Store Client
			var storeClient = {
				storeClient: {
					validateProduct: storeValidator
				}
			};

			var tmfUtils = {
				isOwner: isOwner
			};

			var utils = {
				validateLoggedIn: validateLoggedOk,
				hasRole: checkRoleMethod
			};

			return getCatalogApi(storeClient, tmfUtils, utils);
		};

		var buildProductRequest = function(body) {
			// Basic properties
			var offeringPath = '/catalog/productSpecification/';

			return {
				method: 'POST',
				apiUrl: offeringPath,
				user: {
					id: 'test',
					roles: [{ name: config.oauth2.roles.seller }]
				},
				body: JSON.stringify(body)
			};
		};

		var checkProductCreationResult = function(catalogApi, req, errorStatus, errorMsg, done) {
			catalogApi.checkPermissions(req, function(err) {
				if (!errorStatus && !errorMsg) {
					expect(err).toBe(null);
				} else {
					expect(err.status).toBe(errorStatus);
					expect(err.message).toBe(errorMsg);
				}

				done();
			});
		};

		var testCreateProduct = function(storeValidator, errorStatus, errorMsg, owner, done) {
			var catalogApi = mockCatalogAPI(owner ? isOwnerTrue : isOwnerFalse, storeValidator);

			var role = owner ? 'Owner' : 'Seller';
			var body = { relatedParty: [{ id: 'test', role: role }], validFor: { startDateTime: '2010-04-12' } };
			var req = buildProductRequest(body);

			checkProductCreationResult(catalogApi, req, errorStatus, errorMsg, done);
		};

		var storeValidatorOk = function(body, user, callback) {
			callback();
		};

		it('should allow to create owned products', function(done) {
			testCreateProduct(storeValidatorOk, null, null, true, done);
		});

		it('should not allow to create non-owned products', function(done) {
			testCreateProduct(storeValidatorOk, 403, INVALID_USER_CREATE, false, done);
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

		var testCreateBundle = function(bundles, errorStatus, errorMsg, done) {
			var catalogApi = mockCatalogAPI(function(req, resource) {
				return !(resource.id === '3');
			}, storeValidatorOk);

			var body = mockBundles(bundles);
			var req = buildProductRequest(body);

			checkProductCreationResult(catalogApi, req, errorStatus, errorMsg, done);
		};

		it('should allow to create bundles when all products specs are single and owned by the user', function(done) {
			var bundles = [
				{
					id: '1',
					status: 200,
					body: {
						id: '1',
						isBundle: false,
						lifecycleStatus: 'Active'
					}
				},
				{
					id: '2',
					status: 200,
					body: {
						id: '2',
						isBundle: false,
						lifecycleStatus: 'Active'
					}
				}
			];

			testCreateBundle(bundles, null, null, done);
		});

		it('should not allow to create bundles when less than two bundle products have been included', function(done) {
			testCreateBundle([], 422, MISSING_BUNDLE_PRODUCTS, done);
		});

		it('should not allow to create bundles when the bundle info does not contain an href field', function(done) {
			var bundles = [
				{
					id: '15',
					status: 200,
					body: null
				},
				{}
			];

			testCreateBundle(bundles, 422, MISSING_HREF_BUNDLE_INFO, done);
		});

		it('should not allow to create bundles when one of the included bundled products does not exists', function(done) {
			var bundles = [
				{
					id: '1',
					status: 200,
					body: {
						id: '1',
						isBundle: false,
						lifecycleStatus: 'Active'
					}
				},
				{
					id: '2',
					status: 404,
					body: {}
				}
			];

			testCreateBundle(bundles, 422, INVALID_PRODUCT, done);
		});

		it('should not allow to create bundles when the user is not owning one of the bundled products', function(done) {
			var bundles = [
				{
					id: '1',
					status: 200,
					body: {
						id: '1',
						isBundle: false,
						lifecycleStatus: 'Active'
					}
				},
				{
					id: '3',
					status: 200,
					body: {
						id: '3',
						isBundle: false,
						lifecycleStatus: 'Active'
					}
				}
			];

			testCreateBundle(bundles, 403, UNAUTHORIZED_BUNDLE, done);
		});

		it('should not allow to create bundles when one of the bundled products is also a bundle', function(done) {
			var bundles = [
				{
					id: '1',
					status: 200,
					body: {
						id: '1',
						isBundle: true
					}
				},
				{
					id: '2',
					status: 200,
					body: {
						id: '2',
						isBundle: false,
						lifecycleStatus: 'Active'
					}
				}
			];

			testCreateBundle(bundles, 422, BUNDLE_INSIDE_BUNDLE, done);
		});

		it('should not allow to create bundles with product specs that are not active or launched', function(done) {
			var bundles = [
				{
					id: '1',
					status: 200,
					body: {
						id: '1',
						isBundle: false,
						lifecycleStatus: 'Active'
					}
				},
				{
					id: '2',
					status: 200,
					body: {
						id: '2',
						isBundle: false,
						lifecycleStatus: 'Retired'
					}
				}
			];

			testCreateBundle(bundles, 422, INVALID_BUNDLED_PRODUCT_STATUS, done);
		});
	});

	var testCreateCategory = function(
		admin,
		category,
		categoriesRequest,
		parentCategoryRequest,
		errorStatus,
		errorMsg,
		done
	) {
		var checkRoleMethod = jasmine.createSpy();
		checkRoleMethod.and.returnValues(admin);

		var utils = {
			validateLoggedIn: validateLoggedOk,
			hasRole: checkRoleMethod
		};

		var catalogApi = getCatalogApi({}, {}, utils);

		// Basic properties
		var userName = 'test';
		var protocol = config.endpoints.catalog.appSsl ? 'https' : 'http';
		var url = protocol + '://' + config.endpoints.catalog.host + ':' + config.endpoints.catalog.port;
		var catalogPath = '/category';

		category.validFor = {};
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

		// Mock server used by the proxy to check if the parent category is valid
		if (parentCategoryRequest) {
			nock(url)
				.get(catalogPath + '/' + category.parentId)
				.reply(parentCategoryRequest.status);
		}

		catalogApi.checkPermissions(req, function(err) {
			if (!errorStatus && !errorMsg) {
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
			query: '?lifecycleStatus=Launched&name=' + categoryName + '&isRoot=true',
			status: 200,
			body: []
		};

		testCreateCategory(true, { name: categoryName }, categoriesRequest, null, null, null, callback);
	});

	it('should not allow to create category when existing categories cannot be checked', function(callback) {
		var categoryName = 'example';

		var categoriesRequest = {
			query: '?lifecycleStatus=Launched&name=' + categoryName + '&isRoot=true',
			status: 500,
			body: 'ERROR'
		};

		testCreateCategory(
			true,
			{ name: categoryName },
			categoriesRequest,
			null,
			500,
			CATEGORIES_CANNOT_BE_CHECKED,
			callback
		);
	});

	it('should not allow to create root category if there is a root category with the same name', function(callback) {
		var categoryName = 'example';

		var categoriesRequest = {
			query: '?lifecycleStatus=Launched&name=' + categoryName + '&isRoot=true',
			status: 200,
			body: [{}]
		};

		testCreateCategory(true, { name: categoryName }, categoriesRequest, null, 409, CATEGORY_EXISTS, callback);
	});

	it('should not allow to create non-root category if there is another category at the same level with the same name', function(callback) {
		var categoryName = 'example';
		var parentId = 7;

		var categoriesRequest = {
			query: '?lifecycleStatus=Launched&name=' + categoryName + '&parentId=' + parentId,
			status: 200,
			body: [{}]
		};

		var parentCategoryName = {
			status: 200
		};

		testCreateCategory(
			true,
			{ name: categoryName, isRoot: false, parentId: parentId },
			categoriesRequest,
			parentCategoryName,
			409,
			CATEGORY_EXISTS,
			callback
		);
	});

	it('should not allow non-admin users to create categories', function(callback) {
		testCreateCategory(false, {}, null, null, 403, 'Only administrators can create categories', callback);
	});

	it('should not allow to create categories when name is not included', function(callback) {
		testCreateCategory(true, { isRoot: true }, null, null, 400, CATEGORY_NAME_MISSING, callback);
	});

	it('should not allow to create categories when parentId is included for root categories', function(callback) {
		testCreateCategory(true, { parentId: 7, isRoot: true }, null, null, 400, PARENT_ID_INCLUDED, callback);
	});

	it('should not allow to create categories non-root categories without parent', function(callback) {
		testCreateCategory(true, { isRoot: false }, null, null, 400, MISSING_PARENT_ID, callback);
	});

	it('should not allow to create categories non-root with invalid parent', function(callback) {
		var category = {
			name: 'example',
			isRoot: false,
			parentId: 'wrong'
		};

		var parentCategoryRequest = {
			status: 404
		};

		testCreateCategory(
			true,
			category,
			null,
			parentCategoryRequest,
			400,
			INVALID_CATEGORY_ID + category.parentId,
			callback
		);
	});

	it('should not allow to create non-root category when parent category cannot be checked', function(callback) {
		var parentId = 'wrong';

		var category = {
			name: 'example',
			isRoot: false,
			parentId: parentId
		};

		var parentCategoryRequest = {
			status: 500
		};

		var errorMsg = CATEGORY_CANNOT_BE_CHECKED[0] + category.parentId + CATEGORY_CANNOT_BE_CHECKED[1];

		testCreateCategory(true, category, null, parentCategoryRequest, 500, errorMsg, callback);
	});

	var testCreateCatalog = function(admin, owner, catalog, catalogRequest, errorStatus, errorMsg, updated, done) {
		var checkRoleMethod = jasmine.createSpy();
		checkRoleMethod.and.returnValues(admin);

		var nowStr = '2017-10-06T10:00:00.000Z';
		jasmine.clock().mockDate(new Date(nowStr));

		var updateBody = jasmine.createSpy();

		var utils = {
			validateLoggedIn: validateLoggedOk,
			hasRole: checkRoleMethod,
			updateBody: updateBody
		};

		var tmfUtils = {
			isOwner: owner ? isOwnerTrue : isOwnerFalse
		};

		var catalogApi = getCatalogApi({}, tmfUtils, utils);

		// Basic properties
		var userName = 'test';
		var protocol = config.endpoints.catalog.appSsl ? 'https' : 'http';
		var url = protocol + '://' + config.endpoints.catalog.host + ':' + config.endpoints.catalog.port;
		var catalogPath = '/catalog';

		// Call the method
		var req = {
			method: 'POST',
			apiUrl: catalogPath,
			user: {
				partyId: userName,
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

		catalogApi.checkPermissions(req, function(err) {
			if (!errorStatus && !errorMsg) {
				expect(err).toBe(null);
				if (updated) {
					// Valid for field should have been injected
					var expCat = JSON.parse(JSON.stringify(catalog));
					expCat.validFor = {
						startDateTime: nowStr
					};
					expect(utils.updateBody).toHaveBeenCalledWith(req, expCat);
				} else {
					expect(utils.updateBody).not.toHaveBeenCalled();
				}
			} else {
				expect(err.status).toBe(errorStatus);
				expect(err.message).toBe(errorMsg);
			}

			done();
		});
	};

	it('should allow to create owned catalog', function(done) {
		var catalogName = 'example';

		var catalogRequest = {
			query: '?name=' + catalogName,
			status: 200,
			body: []
		};

		testCreateCatalog(true, isOwnerTrue, { name: catalogName }, catalogRequest, null, null, true, done);
	});

	it('should allow to create an owned catalog providing the validFor field', function(done) {
		var catalogName = 'example';

		var catalogRequest = {
			query: '?name=' + catalogName,
			status: 200,
			body: []
		};

		testCreateCatalog(
			true,
			isOwnerTrue,
			{ name: catalogName, validFor: '2017-10-05T10:00:00' },
			catalogRequest,
			null,
			null,
			false,
			done
		);
	});

	it('should not allow to create not owned catalog', function(done) {
		var catalogName = 'example';

		var catalogRequest = {
			query: '?name=' + catalogName,
			status: 200,
			body: []
		};

		testCreateCatalog(
			true,
			isOwnerFalse,
			{ name: catalogName, validFor: '2017-10-05T10:00:00' },
			catalogRequest,
			null,
			null,
			false,
			done
		);
	});

	it('should not allow to create catalog when existing catalogs cannot be checked', function(done) {
		var catalogName = 'example';

		var catalogRequest = {
			query: '?name=' + catalogName,
			status: 500,
			body: 'ERROR'
		};

		testCreateCatalog(
			true,
			isOwnerFalse,
			{ name: catalogName },
			catalogRequest,
			500,
			CATALOG_CANNOT_BE_CHECKED,
			false,
			done
		);
	});

	it('should not allow to create catalog if there is a catalog with the same name', function(done) {
		var catalogName = 'example';

		var catalogRequest = {
			query: '?name=' + catalogName,
			status: 200,
			body: [{}]
		};

		testCreateCatalog(true, isOwnerFalse, { name: catalogName }, catalogRequest, 409, CATALOG_EXISTS, false, done);
	});

	/// ///////////////////////////////////////////////////////////////////////////////////////////
	/// //////////////////////////////////// UPDATE & DELETE //////////////////////////////////////
	/// ///////////////////////////////////////////////////////////////////////////////////////////

	// ANY ASSET

	var testUpdate = function(method, requestStatus, isOwnerMethod, expStatus, expMsg, done) {
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
		var path = '/productSpecification/1';
		var protocol = config.endpoints.catalog.appSsl ? 'https' : 'http';
		var url = protocol + '://' + config.endpoints.catalog.host + ':' + config.endpoints.catalog.port;
		var role = isOwnerMethod() ? 'Owner' : 'Seller';

		// User information is send when the request does not fail
		var bodyOk = { relatedParty: [{ id: userName, role: role }], lifecycleStatus: 'Active' };
		var bodyErr = 'Internal Server Error';
		var returnedBody = requestStatus !== 200 ? bodyErr : bodyOk;
		// The mock server that will handle the request
		if (requestStatus!=null){
			nock(url)
			.get(path)
			.reply(requestStatus, returnedBody);
		}

		// Call the method
		var req = {
			method: method,
			apiUrl: basepath + path,
			user: {
				id: userName,
				roles: []
			},
			body: {}
		};

		catalogApi.checkPermissions(req, function(err) {
			if (isOwnerMethod() && requestStatus === 200) {
				expect(err).toBe(null);
			} else {
				expect(err.status).toBe(expStatus);
				expect(err.message).toBe(expMsg);
			}

			done();
		});
	};

	it('should allow to to update (PATCH) an owned resource', function(done) {
		testUpdate('PATCH', 200, isOwnerTrue, null, null, done);
	});

	it('should not allow to update (PATCH) a non-owned resource', function(done) {
		testUpdate('PATCH', 200, isOwnerFalse, 403, INVALID_USER_UPDATE, done);
	});

	it('should not allow to update (PATCH) a resource that cannot be checked', function(done) {
		// The value of isOwner does not matter when requestFails is set to true
		testUpdate('PATCH', 500, isOwnerTrue, 500, FAILED_TO_RETRIEVE, done);
	});

	it('should not allow to update (PATCH) a resource that does not exist', function(done) {
		// The value of isOwner does not matter when requestFails is set to true
		testUpdate('PATCH', 404, isOwnerTrue, 404, 'The required resource does not exist', done);
	});

	it('should not allow to make delete requests to the catalog API when no accessing category API', function(done) {
		testUpdate('DELETE', null, isOwnerTrue, 405, INVALID_METHOD, done);
	});

	// OFFERINGS

	var getProductSpecification = function(path) {
		return {
			// the server will be avoided by the SW
			// The catalog server will be used instead
			href: config.endpoints.catalog.host + ':' + config.endpoints.catalog.port + path,
			id: (() => {
				const spl = path.split('/')
				return spl[spl.length-1]
			})()
		};
	};

	var testUpdateProductOffering = function(
		offeringBody,
		productRequestInfo,
		rsModelRequestInfo,
		catalogRequestInfo,
		expectedErrorStatus,
		expectedErrorMsg,
		updated,
		done
	) {
		var checkRoleMethod = jasmine.createSpy();
		checkRoleMethod.and.returnValue(true);

		var defaultErrorMessage = 'Internal Server Error';

		var tmfUtils = {
			isOwner: productRequestInfo.owner ? isOwnerTrue : isOwnerFalse
		};

		var nowStr = '2017-10-06T10:00:00.000Z';
		jasmine.clock().mockDate(new Date(nowStr));

		var updateBody = jasmine.createSpy();

		var utils = {
			validateLoggedIn: validateLoggedOk,
			hasRole: checkRoleMethod,
			updateBody: updateBody
		};

		var rssClient = {
			rssClient: {
				createProvider: function(userInfo, callback) {
					callback(null);
				},
				retrieveRSModel: function(user, serviceCandidateId, callback) {
					callback(rsModelRequestInfo.err, rsModelRequestInfo.res);
				}
			}
		};

		var catalogApi = getCatalogApi({}, tmfUtils, utils, rssClient);

		// Basic properties
		var userName = 'test';
		var catalogPath = '/catalog/8';
		var offeringPath =  '/productOffering/1';
		var productPath = productRequestInfo.path || '/productSpecification/7';
		var protocol = config.endpoints.catalog.appSsl ? 'https' : 'http';
		var serverUrl = protocol + '://' + config.endpoints.catalog.host + ':' + config.endpoints.catalog.port;

		// HTTP MOCK - OFFERING
		var bodyGetOffering = {
			productSpecification: getProductSpecification(productPath)
		};

		nock(serverUrl)
			.get(offeringPath)
			.reply(200, bodyGetOffering);

		// The mock server that will handle the request when the product is requested
		var role = productRequestInfo.owner ? 'Owner' : 'Seller';
		var bodyOk = {
			relatedParty: [{ id: userName, role: role }],
			lifecycleStatus: productRequestInfo.lifecycleStatus
		};
		var bodyGetProduct = productRequestInfo.requestStatus === 200 ? bodyOk : defaultErrorMessage;

		nock(serverUrl)
			.get(productPath)
			.reply(productRequestInfo.requestStatus, bodyGetProduct);

		// The mock server that will handle the request when the catalog is requested
		var bodyGetCatalogOk = { lifecycleStatus: catalogRequestInfo.lifecycleStatus };
		var bodyGetCatalog = catalogRequestInfo.requestStatus === 200 ? bodyGetCatalogOk : defaultErrorMessage;

		nock(serverUrl)
			.get(catalogPath)
			.reply(catalogRequestInfo.requestStatus, bodyGetCatalog);

		// Call the method
		var req = {
			// If the previous tests works, it can be deducted that PUT, PATCH and DELETE
			// requests are handled in the same way so here we do not need additional tests
			// for the different HTTP verbs.
			method: 'PATCH',
			apiUrl: basepath +catalogPath+offeringPath,
			user: {
				id: userName,
				roles: []
			},
			body: offeringBody
		};

		catalogApi.checkPermissions(req, function(err) {
			if (!expectedErrorStatus && !expectedErrorMsg) {
				expect(err).toBe(null);

				if (updated) {
					// Valid for field should have been injected
					var expOff = JSON.parse(offeringBody);

					expOff.validFor = {
						startDateTime: nowStr
					};

					expect(utils.updateBody).toHaveBeenCalledWith(req, expOff);
				} else {
					expect(utils.updateBody).not.toHaveBeenCalled();
				}
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

		testUpdateProductOffering({}, productRequestInfo, null, catalogRequestInfo, null, null, false, done);
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

		testUpdateProductOffering(newOffering, productRequestInfo, null, catalogRequestInfo, null, null, true, done);
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

		testUpdateProductOffering(
			JSON.stringify({ productSpecification: {} }),
			productRequestInfo,
			null,
			catalogRequestInfo,
			403,
			'Field productSpecification cannot be modified',
			false,
			done
		);
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
		testUpdateProductOffering(
			{},
			productRequestInfo,
			null,
			catalogRequestInfo,
			403,
			UPDATE_OFFERING_WITH_NON_OWNED_PRODUCT,
			false,
			done
		);
	});

	it('should not allow to update an offering when the attached product cannot be retrieved', function(done) {
		var productRequestInfo = {
			requestStatus: 500,
			owner: true, // It does not matter
			lifecycleStatus: 'active'
		};

		var catalogRequestInfo = {
			requestStatus: 200,
			lifecycleStatus: 'active'
		};

		testUpdateProductOffering({}, productRequestInfo, null, catalogRequestInfo, 422, INVALID_PRODUCT, false, done);
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
		testUpdateProductOffering(offeringBody, productRequestInfo, null, catalogRequestInfo, null, null, true, done);
	});

	it('should not allow to update offerings when the body is not a valid JSON', function(done) {
		testUpdateProductOffering('{ TEST', {}, null, {}, 400, INVALID_JSON, false, done);
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

		testUpdateProductOffering(
			offeringBody,
			productRequestInfo,
			null,
			catalogRequestInfo,
			400,
			'Offerings can only be ' + 'launched when the attached catalog is also launched',
			false,
			done
		);
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

		testUpdateProductOffering(
			offeringBody,
			productRequestInfo,
			null,
			catalogRequestInfo,
			400,
			'Offerings can only be ' + 'launched when the attached product is also launched',
			false,
			done
		);
	});

	// fit('should not allow to update offerings when the RS model cannot be checked', function(done) {
	// 	var errorMsg = 'RSS failure';
	// 	var statusCode = 500;

	// 	var offeringBody = JSON.stringify({
	// 		serviceCandidate: {
	// 			id: 'example'
	// 		}
	// 	});

	// 	var rsModelRequestInfo = {
	// 		err: {
	// 			status: statusCode,
	// 			message: errorMsg
	// 		}
	// 	};

	// 	testUpdateProductOffering(offeringBody, {}, rsModelRequestInfo, {}, statusCode, errorMsg, false, done);
	// });

	// fit('should not allow to update offerings when the RS model is not valid', function(done) {
	// 	var offeringBody = JSON.stringify({
	// 		serviceCandidate: {
	// 			id: 'wrong'
	// 		}
	// 	});

	// 	var rsModelRequestInfo = {
	// 		err: null,
	// 		res: {
	// 			body: '{}'
	// 		}
	// 	};

	// 	testUpdateProductOffering(offeringBody, {}, rsModelRequestInfo, {}, 422, INVALID_PRODUCT_CLASS, false, done);
	// });

	// PRODUCTS & CATALOGS

	var previousProductBody = {
		relatedParty: [
			{
				id: 'exmaple1',
				href: 'http://localhost:8000/example1',
				role: 'owner'
			},
			{
				id: 'exmaple2',
				href: 'http://localhost:8000/example2',
				role: 'seller'
			}
		]
	};

	var testChangeProductCatalogStatus = function(
		assetPath,
		offeringsPath,
		previousAssetBody,
		assetBody,
		offeringsInfo,
		errorStatus,
		errorMsg,
		done,
		storeClient
	) {
		var checkRoleMethod = jasmine.createSpy();
		checkRoleMethod.and.returnValue(true);

		var defaultErrorMessage = 'Internal Server Error';

		var tmfUtils = {
			isOwner: function() {
				return true;
			}
		};

		var utils = {
			validateLoggedIn: validateLoggedOk,
			hasRole: checkRoleMethod
		};

		var store = {};
		if (storeClient) {
			store = storeClient;
		}

		
		// Basic properties
		var userName = 'test';
		var protocol = config.endpoints.catalog.appSsl ? 'https' : 'http';
		var serverUrl = protocol + '://' + config.endpoints.catalog.host + ':' + config.endpoints.catalog.port;
		
		// The service will check that the user is the owner of the offering by making a request
		// to the API. However, a body is not required since the function isOwner has been set up
		// to return always true.
		nock(serverUrl)
		.get(assetPath)
		.reply(200, previousAssetBody);
		
		if (!offeringsInfo) {
			offeringsInfo = {
				requestStatus: 500
			};
		}
		// The service that all the offerings are in a valid state to complete the status change
		var bodyGetOfferings = offeringsInfo.requestStatus === 200 ? offeringsInfo.offerings : defaultErrorMessage;
		var catalogApi = getCatalogApi(store, tmfUtils, utils, null, { 
			search: function(index, query){ return Promise.resolve(offeringsInfo.offerings)}
		});
		nock(serverUrl)
			.get(offeringsPath)
			.reply(offeringsInfo.requestStatus, bodyGetOfferings);
		// Call the method
		var req = {
			// If the previous tests works, it can be deducted that PUT, PATCH and DELETE
			// requests are handled in the same way so here we do not need additional tests
			// for the different HTTP verbs.
			method: 'PATCH',
			apiUrl: basepath + assetPath,
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

	var testChangeProductStatus = function(productBody, offeringsInfo, errorStatus, errorMsg, done, status) {
		var productId = '7';
		var productPath = '/productSpecification/' + productId;
		var offeringsPath = '/productOffering?productSpecification.id=' + productId;

		var bodyStatus = 'Active';

		if (status) {
			bodyStatus = status;
		}

		var prevBody = {
			lifecycleStatus: bodyStatus,
			relatedParty: previousProductBody.relatedParty,
			validFor: {}
		};
		testChangeProductCatalogStatus(
			productPath,
			offeringsPath,
			prevBody,
			productBody,
			offeringsInfo,
			errorStatus,
			errorMsg,
			done
		);
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

	it('should not allow to update a product if the body modifies the original relatedParty', function(done) {
		var productBody = JSON.stringify({
			relatedParty: [
				{
					id: 'wrong',
					href: previousProductBody.relatedParty[0].href,
					owner: previousProductBody.relatedParty[0].role
				},
				previousProductBody.relatedParty[1]
			]
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: []
		};

		testChangeProductStatus(productBody, offeringsInfo, 409, INVALID_RELATED_PARTY, done);
	});

	it('should allow to update a product if the body does not modify the original relatedParty', function(done) {
		var productBody = JSON.stringify({
			relatedParty: [previousProductBody.relatedParty[1], previousProductBody.relatedParty[0]]
		});

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
			offerings: [
				{
					lifecycleStatus: 'ReTiReD'
				}
			]
		};

		testChangeProductStatus(productBody, offeringsInfo, null, null, done);
	});

	it('should allow to retire a product when there is one attached offering with obsolete status', function(done) {
		var productBody = JSON.stringify({
			lifecycleStatus: 'retired'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					lifecycleStatus: 'ObSoLeTe'
				}
			]
		};

		testChangeProductStatus(productBody, offeringsInfo, null, null, done);
	});

	it('should not allow to retire a product when there is one attached offering with active status', function(done) {
		var productBody = JSON.stringify({
			lifecycleStatus: 'retired'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					lifecycleStatus: 'AcTIve'
				}
			]
		};

		testChangeProductStatus(productBody, offeringsInfo, 400, OFFERS_NOT_RETIRED_PRODUCT, done);
	});

	it('should allow to retire a product when there are two attached offerings - one retired and one obsolete', function(done) {
		var productBody = JSON.stringify({
			lifecycleStatus: 'retired'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					lifecycleStatus: 'ObSoLEte'
				},
				{
					lifecycleStatus: 'RetiReD'
				}
			]
		};

		testChangeProductStatus(productBody, offeringsInfo, null, null, done);
	});

	it('should not allow to retire a product when there is at least one attached offering with launched status', function(done) {
		var productBody = JSON.stringify({
			lifecycleStatus: 'retired'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					lifecycleStatus: 'retired'
				},
				{
					lifecycleStatus: 'launched'
				}
			]
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
			offerings: [
				{
					lifecycleStatus: 'ObSoLeTE'
				}
			]
		};

		testChangeProductStatus(productBody, offeringsInfo, null, null, done);
	});

	it('should not allow to make a product obsolete when there is one attached offering with retired status', function(done) {
		var productBody = JSON.stringify({
			lifecycleStatus: 'obsolete'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					lifecycleStatus: 'retired'
				}
			]
		};

		testChangeProductStatus(productBody, offeringsInfo, 400, OFFERS_NOT_OBSOLETE_PRODUCT, done);
	});

	it('should allow to make a product obsolete when there are two attached obsolete offerings', function(done) {
		var productBody = JSON.stringify({
			lifecycleStatus: 'obsolete'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					lifecycleStatus: 'ObSoLEte'
				},
				{
					lifecycleStatus: 'obsolete'
				}
			]
		};

		testChangeProductStatus(productBody, offeringsInfo, null, null, done);
	});

	it('should not allow to make a product obsolete when there is at least one attached offering with retired status', function(done) {
		var productBody = JSON.stringify({
			lifecycleStatus: 'ObsOletE'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					lifecycleStatus: 'retired'
				},
				{
					lifecycleStatus: 'obsolete'
				}
			]
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

	// UPGRADES

	var testProductUpgrade = function(prevBody, productBody, errorStatus, errorMsg, storeClient, done) {
		var productId = '7';
		var productPath = '/productSpecification/' + productId;
		var offeringsPath = '/productOffering?productSpecification.id=' + productId;

		testChangeProductCatalogStatus(
			productPath,
			offeringsPath,
			prevBody,
			JSON.stringify(productBody),
			null,
			errorStatus,
			errorMsg,
			done,
			storeClient
		);
	};

	var testNonDigitalUpgrade = function(newBody, errorStatus, errorMsg, done) {
		var prevBody = {
			version: '1.0',
			lifecycleStatus: 'Active',
			validFor: {},
			productSpecCharacteristic: [
				{
					name: 'Color',
					productSpecCharacteristicValue: [
						{
							value: 'blue'
						},
						{
							value: 'green'
						}
					]
				}
			]
		};

		testProductUpgrade(prevBody, newBody, errorStatus, errorMsg, null, done);
	};

	it('should allow to upgrade a non-digital product when the characteristics are provided', function(done) {
		var newBody = {
			version: '1.1',
			productSpecCharacteristic: [
				{
					name: 'Color',
					productSpecCharacteristicValue: [
						{
							value: 'blue'
						},
						{
							value: 'green'
						}
					]
				}
			]
		};
		testNonDigitalUpgrade(newBody, null, null, done);
	});

	it('should allow to upgrade a non-digital product when the characteristics are not provided', function(done) {
		var newBody = {
			version: '1.1'
		};
		testNonDigitalUpgrade(newBody, null, null, done);
	});

	/*it('should not allow to upgrade a non-digital product when the characteristics are provided', function(done) {
		var newBody = {
			version: '1.1',
			productSpecCharacteristic: [
				{
					name: 'Color',
					productSpecCharacteristicValue: [
						{
							value: 'blue'
						},
						{
							value: 'red'
						}
					]
				}
			]
		};
		testNonDigitalUpgrade(newBody, 422, INVALID_NON_DIGITAL_UPGRADE, done);
	});*/

	var testDigitalUpgrade = function(newBody, errorStatus, errorMsg, done) {
		var storeClient = jasmine.createSpyObj('storeClient', ['upgradeProduct']);
		storeClient.upgradeProduct.and.callFake((data, user, callback) => {
			callback(null);
		});

		var prevBody = {
			id: 2,
			version: '1.0',
			lifecycleStatus: 'Active',
			validFor: {},
			productSpecCharacteristic: [
				{
					name: 'speed',
					productSpecCharacteristicValue: [
						{
							value: '100mb'
						}
					]
				},
				{
					name: 'media type',
					productSpecCharacteristicValue: [
						{
							value: 'JSON'
						}
					]
				},
				{
					name: 'location',
					productSpecCharacteristicValue: [
						{
							value: 'http://assset.com'
						}
					]
				},
				{
					name: 'asset type',
					productSpecCharacteristicValue: [
						{
							value: 'basic service'
						}
					]
				}
			]
		};

		testProductUpgrade(prevBody, newBody, errorStatus, errorMsg, { storeClient: storeClient }, () => {
			// Check store client call
			if (!errorMsg) {
				expect(storeClient.upgradeProduct).toHaveBeenCalledWith(
					{
						id: prevBody.id,
						version: newBody.version,
						productSpecCharacteristic: newBody.productSpecCharacteristic
					},
					{
						id: 'test',
						roles: [{ name: 'seller' }]
					},
					jasmine.any(Function)
				);
			} else {
				expect(storeClient.upgradeProduct).not.toHaveBeenCalled();
			}
			done();
		});
	};

	it('should upgrade a digital product when the new characteristics and version are provided', function(done) {
		var newVersion = {
			version: '1.1',
			lifecycleStatus: 'Active',
			productSpecCharacteristic: [
				{
					name: 'speed',
					productSpecCharacteristicValue: [
						{
							value: '100mb'
						}
					]
				},
				{
					name: 'media type',
					productSpecCharacteristicValue: [
						{
							value: 'JSON'
						}
					]
				},
				{
					name: 'location',
					productSpecCharacteristicValue: [
						{
							value: 'http://assetv2.com'
						}
					]
				},
				{
					name: 'asset type',
					productSpecCharacteristicValue: [
						{
							value: 'basic service'
						}
					]
				}
			]
		};

		testDigitalUpgrade(newVersion, null, null, done);
	});

	it('should not upgrade a digital product when the asset is not provided', function(done) {
		var newVersion = {
			version: '1.1',
			lifecycleStatus: 'Active',
			productSpecCharacteristic: [
				{
					name: 'speed',
					productSpecCharacteristicValue: [
						{
							value: '100mb'
						}
					]
				}
			]
		};

		testDigitalUpgrade(newVersion, 422, UPGRADE_ASSET_NOT_PROVIDED, done);
	});

	it('should not upgrade a digital product when the new version is not provided', function(done) {
		var newVersion = {
			lifecycleStatus: 'Active',
			productSpecCharacteristic: [
				{
					name: 'speed',
					productSpecCharacteristicValue: [
						{
							value: '100mb'
						}
					]
				},
				{
					name: 'media type',
					productSpecCharacteristicValue: [
						{
							value: 'JSON'
						}
					]
				},
				{
					name: 'location',
					productSpecCharacteristicValue: [
						{
							value: 'http://assetv2.com'
						}
					]
				},
				{
					name: 'asset type',
					productSpecCharacteristicValue: [
						{
							value: 'basic service'
						}
					]
				}
			]
		};

		testDigitalUpgrade(newVersion, 422, UPGRADE_VERSION_NOT_PROVIDED, done);
	});

	it('should not upgrade a digital product when the new version is equal to the previous one', function(done) {
		var newVersion = {
			version: '1.0',
			lifecycleStatus: 'Active',
			productSpecCharacteristic: [
				{
					name: 'speed',
					productSpecCharacteristicValue: [
						{
							value: '100mb'
						}
					]
				},
				{
					name: 'media type',
					productSpecCharacteristicValue: [
						{
							value: 'JSON'
						}
					]
				},
				{
					name: 'location',
					productSpecCharacteristicValue: [
						{
							value: 'http://assetv2.com'
						}
					]
				},
				{
					name: 'asset type',
					productSpecCharacteristicValue: [
						{
							value: 'basic service'
						}
					]
				}
			]
		};

		testDigitalUpgrade(newVersion, 422, UPGRADE_VERSION_NOT_PROVIDED, done);
	});

	it('should not upgrade a digital product when the custom characteristics are modified', function(done) {
		var newVersion = {
			version: '1.1',
			lifecycleStatus: 'Active',
			productSpecCharacteristic: [
				{
					name: 'media type',
					productSpecCharacteristicValue: [
						{
							value: 'JSON'
						}
					]
				},
				{
					name: 'location',
					productSpecCharacteristicValue: [
						{
							value: 'http://assetv2.com'
						}
					]
				},
				{
					name: 'asset type',
					productSpecCharacteristicValue: [
						{
							value: 'basic service'
						}
					]
				}
			]
		};

		testDigitalUpgrade(newVersion, 422, UPGRADE_CUSTOM_CHAR_MOD, done);
	});

	// Bundles
	var testUpdateBundle = function(bundles, offeringsInfo, errorStatus, errorMsg, done) {
		var body = mockBundles(bundles);
		testChangeProductStatus(JSON.stringify(body), offeringsInfo, errorStatus, errorMsg, done);
	};

	it('should allow to update bundles when all products specs are single and owned by the user', function(done) {
		var bundles = [
			{
				id: '1',
				status: 200,
				body: {
					id: '1',
					isBundle: false,
					lifecycleStatus: 'Active'
				}
			},
			{
				id: '2',
				status: 200,
				body: {
					id: '2',
					isBundle: false,
					lifecycleStatus: 'Active'
				}
			}
		];

		testUpdateBundle(bundles, null, null, null, done);
	});

	it('should not allow to update bundles when less than two bundle products have been included', function(done) {
		testUpdateBundle([], null, 422, MISSING_BUNDLE_PRODUCTS, done);
	});

	it('should not allow to create bundles when the bundle info does not contain an href field', function(done) {
		var bundles = [
			{
				
				status: 200,
				body: null
			},
			{}
		];

		testUpdateBundle(bundles, null, 422, MISSING_HREF_BUNDLE_INFO, done);
	});

	it('should not allow to create bundles when one of the included bundled products does not exists', function(done) {
		var bundles = [
			{
				id: '1',
				status: 200,
				body: {
					id: '1',
					isBundle: false,
					lifecycleStatus: 'Active'
				}
			},
			{
				id: '2',
				status: 404,
				body: {}
			}
		];

		testUpdateBundle(bundles, null, 422, INVALID_PRODUCT, done);
	});

	it('should not allow to update bundles when one of the bundled products is also a bundle', function(done) {
		var bundles = [
			{
				id: '1',
				status: 200,
				body: {
					id: '1',
					isBundle: true
				}
			},
			{
				id: '2',
				status: 200,
				body: {
					id: '2',
					isBundle: false,
					lifecycleStatus: 'Active'
				}
			}
		];

		testUpdateBundle(bundles, null, 422, BUNDLE_INSIDE_BUNDLE, done);
	});

	it('should not allow to update bundles with product specs that are not active or launched', function(done) {
		var bundles = [
			{
				id: '1',
				status: 200,
				body: {
					id: '1',
					isBundle: false,
					lifecycleStatus: 'Active'
				}
			},
			{
				id: '2',
				status: 200,
				body: {
					id: '2',
					isBundle: false,
					lifecycleStatus: 'Retired'
				}
			}
		];

		testUpdateBundle(bundles, null, 422, INVALID_BUNDLED_PRODUCT_STATUS, done);
	});

	it('should not allow to update bundle info when the product is not in Active state', function(done) {
		var bundles = [
			{
				id: '1',
				status: 200,
				body: {
					id: '1',
					isBundle: false,
					lifecycleStatus: 'Active'
				}
			},
			{
				id: '2',
				status: 200,
				body: {
					id: '2',
					isBundle: false,
					lifecycleStatus: 'Active'
				}
			}
		];

		var body = mockBundles(bundles);
		testChangeProductStatus(JSON.stringify(body), null, 422, INVALID_BUNDLE_STATUS, done, 'Launched');
	});

	// CATALOGS

	var testChangeCatalogStatus = function(productBody, offeringsInfo, errorStatus, errorMsg, done) {
		var catalogPath = '/catalog/7';
		var offeringsPath = '/productOffering';

		var prevBody = {
			validFor: {
				startDateTime: '2017-10-12T10:00:08'
			},
			relatedParty: previousProductBody.relatedParty
		};

		testChangeProductCatalogStatus(
			catalogPath,
			offeringsPath,
			prevBody,
			productBody,
			offeringsInfo,
			errorStatus,
			errorMsg,
			done
		);
	};

	var testChangeCatalogStatusHref = function(productBody, offeringsInfo, errorStatus, errorMsg, done) {
		var catalogPath = '/catalog/7';
		var offeringsPath = '/productOffering?href=';

		for(let offering of offeringsInfo.offerings){
			offeringsPath += offering.id + ','
		}
		offeringsPath = offeringsPath.substring(0, offeringsPath.length-1)
		var prevBody = {
			validFor: {
				startDateTime: '2017-10-12T10:00:08'
			},
			relatedParty: previousProductBody.relatedParty
		};

		testChangeProductCatalogStatus(
			catalogPath,
			offeringsPath,
			prevBody,
			productBody,
			offeringsInfo,
			errorStatus,
			errorMsg,
			done
		);
	};

	it('should not allow to retire a catalog when the body is invalid', function(done) {
		var catalogBody = "{'lifecycleStatus': retired}";

		var offeringsInfo = {
			requestStatus: 200,
			offerings: []
		};

		testChangeCatalogStatus(catalogBody, offeringsInfo, 400, INVALID_JSON, done);
	});

	it('should allow to update a catalog if the body does not contains cycle information', function(done) {
		var catalogBody = {};

		var offeringsInfo = {
			requestStatus: 200,
			offerings: []
		};

		testChangeCatalogStatus(catalogBody, offeringsInfo, null, null, done);
	});

	it('should not allow to update a catalog if the body modifies the original relatedParty', function(done) {
		var catalogBody = JSON.stringify({
			relatedParty: [
				{
					id: 'wrong',
					href: previousProductBody.relatedParty[0].href,
					owner: previousProductBody.relatedParty[0].role
				},
				previousProductBody.relatedParty[1]
			]
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: []
		};

		testChangeCatalogStatus(catalogBody, offeringsInfo, 409, INVALID_RELATED_PARTY, done);
	});

	it('should allow to update a catalog if the body does not modifie the original relatedParty', function(done) {
		var catalogBody = JSON.stringify({
			relatedParty: [previousProductBody.relatedParty[1], previousProductBody.relatedParty[0]]
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: []
		};

		testChangeCatalogStatus(catalogBody, offeringsInfo, null, null, done);
	});

	it('should allow launch a catalog', function(done) {
		var catalogBody = JSON.stringify({
			lifecycleStatus: 'launched'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					lifecycleStatus: 'active'
				}
			]
		};

		testChangeCatalogStatus(catalogBody, offeringsInfo, null, null, done);
	});

	// Retire

	it('should allow to retire a catalog when there are no attached offerings', function(done) {
		var catalogBody = JSON.stringify({
			lifecycleStatus: 'retired'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: []
		};

		testChangeCatalogStatus(catalogBody, offeringsInfo, null, null, done);
	});

	it('should allow to retire a catalog when there is one attached offering with retired status', function(done) {
		var catalogBody = JSON.stringify({
			lifecycleStatus: 'retired'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					id: 7,
					lifecycleStatus: 'ReTiReD'
				}
			]
		};

		testChangeCatalogStatusHref(catalogBody, offeringsInfo, null, null, done);
	});

	it('should allow to retire a catalog when there is one attached offering with obsolete status', function(done) {
		var catalogBody = JSON.stringify({
			lifecycleStatus: 'retired'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					id: 7,
					lifecycleStatus: 'ObSoLeTe'
				}
			]
		};

		testChangeCatalogStatusHref(catalogBody, offeringsInfo, null, null, done);
	});

	it('should not allow to retire a catalog when there is one attached offering with active status', function(done) {
		var catalogBody = JSON.stringify({
			lifecycleStatus: 'retired'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					id: 7,
					lifecycleStatus: 'AcTIve'
				}
			]
		};

		testChangeCatalogStatusHref(catalogBody, offeringsInfo, 400, OFFERS_NOT_RETIRED_CATALOG, done);
	});

	it('should allow to retire a catalog when there are two attached offerings - one retired and one obsolete', function(done) {
		var catalogBody = JSON.stringify({
			lifecycleStatus: 'retired'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					id: 7,
					lifecycleStatus: 'ObSoLEte'
				},
				{
					id: 8,
					lifecycleStatus: 'RetiReD'
				}
			]
		};

		testChangeCatalogStatusHref(catalogBody, offeringsInfo, null, null, done);
	});

	it('should not allow to retire a catalog when there is at least one attached offering with launched status', function(done) {
		var catalogBody = JSON.stringify({
			lifecycleStatus: 'retired'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					id: 8,
					lifecycleStatus: 'retired'
				},
				{
					id: 9,
					lifecycleStatus: 'launched'
				}
			]
		};

		testChangeCatalogStatusHref(catalogBody, offeringsInfo, 400, OFFERS_NOT_RETIRED_CATALOG, done);
	});

	// it('should not allow to retire a catalog if the attached offerings cannot be retrieved', function(done) {
	// 	var catalogBody = JSON.stringify({
	// 		lifecycleStatus: 'retired'
	// 	});

	// 	var offeringsInfo = {
	// 		requestStatus: 404,
	// 		offerings: []
	// 	};

	// 	testChangeCatalogStatus(catalogBody, offeringsInfo, 500, OFFERINGS_NOT_RETRIEVED, done);
	// });

	// Make obsolete

	it('should allow to make a catalog obsolete when there are no attached offerings', function(done) {
		var catalogBody = JSON.stringify({
			lifecycleStatus: 'obsolete'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: []
		};

		testChangeCatalogStatus(catalogBody, offeringsInfo, null, null, done);
	});

	it('should allow to make a catalog obsolete when there is one attached offering with obsolete status', function(done) {
		var catalogBody = JSON.stringify({
			lifecycleStatus: 'obsolete'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					id: 7, 
					lifecycleStatus: 'ObSoLeTE'
				}
			]
		};

		testChangeCatalogStatusHref(catalogBody, offeringsInfo, null, null, done);
	});

	it('should not allow to make a catalog obsolete when there is one attached offering with retired status', function(done) {
		var catalogBody = JSON.stringify({
			lifecycleStatus: 'obsolete'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					id: 7, 
					lifecycleStatus: 'retired'
				}
			]
		};

		testChangeCatalogStatusHref(catalogBody, offeringsInfo, 400, OFFERS_NOT_OBSOLETE_CATALOG, done);
	});

	it('should allow to make a catalog obsolete when there are two attached obsolete offerings', function(done) {
		var catalogBody = JSON.stringify({
			lifecycleStatus: 'obsolete'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					id: 7,
					lifecycleStatus: 'ObSoLEte'
				},
				{
					id: 8,
					lifecycleStatus: 'obsolete'
				}
			]
		};

		testChangeCatalogStatusHref(catalogBody, offeringsInfo, null, null, done);
	});

	it('should not allow to make a catalog obsolete when there is at least one attached offering with retired status', function(done) {
		var catalogBody = JSON.stringify({
			lifecycleStatus: 'ObsOletE'
		});

		var offeringsInfo = {
			requestStatus: 200,
			offerings: [
				{
					id: 7,
					lifecycleStatus: 'retired'
				},
				{
					id: 8,
					lifecycleStatus: 'obsolete'
				}
			]
		};

		testChangeCatalogStatusHref(catalogBody, offeringsInfo, 400, OFFERS_NOT_OBSOLETE_CATALOG, done);
	});

	it('should not allow to make a catalog obsolete if the attached offerings cannot be retrieved', function(done) {
		var catalogBody = JSON.stringify({
			lifecycleStatus: 'obsolete'
		});

		var offeringsInfo = {
			requestStatus: 404, //useless
			offerings: []
		};

		testChangeCatalogStatus(catalogBody, offeringsInfo, 200, null, done);
	});

	// CATEGORIES

	var testUpdateCategory = function(
		method,
		admin,
		oldStateRequest,
		existingCategoriesRequest,
		parentCategoryRequest,
		updatedCategory,
		errorStatus,
		errorMessage,
		done
	) {
		var checkRoleMethod = jasmine.createSpy();
		checkRoleMethod.and.returnValue(admin);

		var utils = {
			hasRole: checkRoleMethod
		};

		var catalogApi = getCatalogApi({}, {}, utils);

		var userName = 'test';
		var basicPath = '/category';
		var categoryResourcePath = basicPath + '/7';
		var protocol = config.endpoints.catalog.appSsl ? 'https' : 'http';
		var url = protocol + '://' + config.endpoints.catalog.host + ':' + config.endpoints.catalog.port;

		// The mock server that will handle the request to retrieve the old state of the category
		if (oldStateRequest.body) {
			oldStateRequest.body.validFor = {};
		}
		nock(url)
			.get(categoryResourcePath)
			.reply(oldStateRequest.status, JSON.stringify(oldStateRequest.body));

		if (existingCategoriesRequest) {
			// The mock server that will handle the request to retrieve categories with the same properties
			nock(url)
				.get(basicPath + existingCategoriesRequest.query)
				.reply(existingCategoriesRequest.status, JSON.stringify(existingCategoriesRequest.body));
		}

		if (parentCategoryRequest) {
			// The mock server that will handle the request to retrieve parent categories
			var parentId = updatedCategory.parentId ? updatedCategory.parentId : oldStateRequest.body.parentId;
			nock(url)
				.get(basicPath + '/' + parentId)
				.reply(parentCategoryRequest.status);
		}

		// Call the method
		var req = {
			method: method,
			apiUrl: basepath + categoryResourcePath,
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
		testUpdateCategory('DELETE', true, { status: 200, body: {} }, null, null, null, null, null, done);
	});

	it('should not allow to delete category when no admin', function(done) {
		testUpdateCategory(
			'DELETE',
			false,
			{ status: 200, body: {} },
			null,
			null,
			null,
			403,
			ONLY_ADMINS_MODIFY_CATEGORIES,
			done
		);
	});

	it('should not allow to delete category when category cannot be retrieved', function(done) {
		testUpdateCategory('DELETE', false, { status: 500, body: {} }, null, null, null, 500, FAILED_TO_RETRIEVE, done);
	});

	it('should allow to update description of a category when admin', function(done) {
		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: { name: 'invalid', isRoot: true } },
			null,
			null,
			{ description: 'another-description' },
			null,
			null,
			done
		);
	});

	it('should allow to update name of a root category when admin', function(done) {
		var categoryName = 'valid';

		var categoriesRequest = {
			query: '?lifecycleStatus=Launched&name=' + categoryName + '&isRoot=true',
			status: 200,
			body: []
		};

		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: { name: 'invalid', isRoot: true } },
			categoriesRequest,
			null,
			{ name: categoryName },
			null,
			null,
			done
		);
	});

	it('should allow to update a category when fields include but they do not change', function(done) {
		var category = { name: 'valid', isRoot: false, parentId: 7 };
		var parentCategoryRequest = { status: 200 };

		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: category },
			null,
			parentCategoryRequest,
			category,
			null,
			null,
			done
		);
	});

	it(
		'should not allow to update name of a root category when admin and there are another category with the ' +
		'same name',
		function(done) {
			var categoryName = 'valid';

			var categoriesRequest = {
				query: '?lifecycleStatus=Launched&name=' + categoryName + '&isRoot=true',
				status: 200,
				body: [{}]
			};

			testUpdateCategory(
				'PATCH',
				true,
				{ status: 200, body: { name: 'invalid', isRoot: true } },
				categoriesRequest,
				null,
				{ name: categoryName },
				409,
				CATEGORY_EXISTS,
				done
			);
		}
	);

	it('should not allow to update name of a root category when admin and existing categories cannot be retrieved', function(done) {
		var categoryName = 'valid';

		var categoriesRequest = {
			query: '?lifecycleStatus=Launched&name=' + categoryName + '&isRoot=true',
			status: 500,
			body: []
		};

		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: { name: 'invalid', isRoot: true } },
			categoriesRequest,
			null,
			{ name: categoryName },
			500,
			CATEGORIES_CANNOT_BE_CHECKED,
			done
		);
	});

	it('should allow to update name of a non-root category when admin', function(done) {
		var categoryName = 'correct';
		var parentId = 7;

		var categoriesRequest = {
			query: '?lifecycleStatus=Launched&name=' + categoryName + '&parentId=' + parentId,
			status: 200,
			body: []
		};
		var parentCategoryRequest = { status: 200 };

		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: { name: 'invalid', isRoot: false, parentId: parentId } },
			categoriesRequest,
			parentCategoryRequest,
			{ name: categoryName },
			null,
			null,
			done
		);
	});

	it(
		'should not allow to update name of a non-root category when admin and there are another category with ' +
		'the same name',
		function(done) {
			var categoryName = 'correct';
			var parentId = 7;

			var categoriesRequest = {
				query: '?lifecycleStatus=Launched&name=' + categoryName + '&parentId=' + parentId,
				status: 200,
				body: [{}]
			};
			var parentCategoryRequest = { status: 200 };

			testUpdateCategory(
				'PATCH',
				true,
				{ status: 200, body: { name: 'invalid', isRoot: false, parentId: parentId } },
				categoriesRequest,
				parentCategoryRequest,
				{ name: categoryName },
				409,
				CATEGORY_EXISTS,
				done
			);
		}
	);

	it(
		'should not allow to update name of a non-root category when admin and existing categories cannot ' +
		'be retrieved',
		function(done) {
			var categoryName = 'correct';
			var parentId = 7;

			var categoriesRequest = {
				query: '?lifecycleStatus=Launched&name=' + categoryName + '&parentId=' + parentId,
				status: 500,
				body: []
			};
			var parentCategoryRequest = { status: 200 };

			testUpdateCategory(
				'PATCH',
				true,
				{ status: 200, body: { name: 'invalid', isRoot: false, parentId: parentId } },
				categoriesRequest,
				parentCategoryRequest,
				{ name: categoryName },
				500,
				CATEGORIES_CANNOT_BE_CHECKED,
				done
			);
		}
	);

	it('should not allow to update category when no admin', function(done) {
		testUpdateCategory(
			'PATCH',
			false,
			{ status: 200, body: { name: 'invalid', isRoot: true } },
			null,
			null,
			{ name: 'correct' },
			403,
			ONLY_ADMINS_MODIFY_CATEGORIES,
			done
		);
	});

	it('should not allow to update category when category cannot be retrieved', function(done) {
		testUpdateCategory(
			'PATCH',
			true,
			{ status: 500, body: null },
			null,
			null,
			{ name: 'correct' },
			500,
			FAILED_TO_RETRIEVE,
			done
		);
	});

	it('should not allow to update category when trying to remove parent ID', function(done) {
		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: { name: 'invalid', isRoot: false, parentId: 9 } },
			null,
			null,
			{ name: 'correct', parentId: null },
			400,
			MISSING_PARENT_ID,
			done
		);
	});

	it('should not allow to update category when setting it as non-root without parent', function(done) {
		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: { name: 'invalid' } },
			null,
			null,
			{ name: 'correct', isRoot: false },
			400,
			MISSING_PARENT_ID,
			done
		);
	});

	it('should allow to update category when setting it as non-root and parent already set', function(done) {
		var categoryName = 'correct';
		var parentId = 7;

		var categoriesRequest = {
			query: '?lifecycleStatus=Launched&name=' + categoryName + '&parentId=' + parentId,
			status: 200,
			body: []
		};
		var parentCategoryRequest = { status: 200 };

		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: { name: 'invalid', parentId: parentId } },
			categoriesRequest,
			parentCategoryRequest,
			{ name: categoryName, isRoot: false },
			null,
			null,
			done
		);
	});

	it(
		'should not allow to update category when setting it as non-root and parent already set and another category ' +
		'with the same properties exists',
		function(done) {
			var categoryName = 'correct';
			var parentId = 7;

			var categoriesRequest = {
				query: '?lifecycleStatus=Launched&name=' + categoryName + '&parentId=' + parentId,
				status: 200,
				body: [{}]
			};
			var parentCategoryRequest = { status: 200 };

			testUpdateCategory(
				'PATCH',
				true,
				{ status: 200, body: { name: 'invalid', parentId: parentId } },
				categoriesRequest,
				parentCategoryRequest,
				{ name: categoryName, isRoot: false },
				409,
				CATEGORY_EXISTS,
				done
			);
		}
	);

	it(
		'should not allow to update category when setting it as non-root and parent already set and existing ' +
		'categories cannot be retrieved',
		function(done) {
			var categoryName = 'correct';
			var parentId = 7;

			var categoriesRequest = {
				query: '?lifecycleStatus=Launched&name=' + categoryName + '&parentId=' + parentId,
				status: 500,
				body: []
			};
			var parentCategoryRequest = { status: 200 };

			testUpdateCategory(
				'PATCH',
				true,
				{ status: 200, body: { name: 'invalid', parentId: parentId } },
				categoriesRequest,
				parentCategoryRequest,
				{ name: categoryName, isRoot: false },
				500,
				CATEGORIES_CANNOT_BE_CHECKED,
				done
			);
		}
	);

	it('should not allow to update category when setting it as root category and parent specified', function(done) {
		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: { name: 'invalid' } },
			null,
			null,
			{ name: 'correct', isRoot: true, parentId: 7 },
			400,
			PARENT_ID_INCLUDED,
			done
		);
	});

	it('should not allow to update category when setting it as root category and parent specified #2', function(done) {
		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: { name: 'invalid', isRoot: false, parentId: 7 } },
			null,
			null,
			{ name: 'correct', isRoot: true },
			400,
			PARENT_ID_INCLUDED,
			done
		);
	});

	it('should allow to update category when setting it as root category and parent removed', function(done) {
		var categoryName = 'correct';

		var categoriesRequest = {
			query: '?lifecycleStatus=Launched&name=' + categoryName + '&isRoot=true',
			status: 200,
			body: []
		};

		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: { name: 'invalid', isRoot: false, parentId: 7 } },
			categoriesRequest,
			null,
			{ name: categoryName, isRoot: true, parentId: null },
			null,
			null,
			done
		);
	});

	it(
		'should not allow to update category when setting it as root category and parent removed and another ' +
		'root category with the same name exists',
		function(done) {
			var categoryName = 'correct';

			var categoriesRequest = {
				query: '?lifecycleStatus=Launched&name=' + categoryName + '&isRoot=true',
				status: 200,
				body: [{}]
			};

			testUpdateCategory(
				'PATCH',
				true,
				{ status: 200, body: { name: 'invalid', isRoot: false, parentId: 7 } },
				categoriesRequest,
				null,
				{ name: categoryName, isRoot: true, parentId: null },
				409,
				CATEGORY_EXISTS,
				done
			);
		}
	);

	it(
		'should not allow to update category when setting it as root category and parent removed and existing ' +
		'categories cannot be retrieved',
		function(done) {
			var categoryName = 'correct';

			var categoriesRequest = {
				query: '?lifecycleStatus=Launched&name=' + categoryName + '&isRoot=true',
				status: 500,
				body: []
			};

			testUpdateCategory(
				'PATCH',
				true,
				{ status: 200, body: { name: 'invalid', isRoot: false, parentId: 7 } },
				categoriesRequest,
				null,
				{ name: categoryName, isRoot: true, parentId: null },
				500,
				CATEGORIES_CANNOT_BE_CHECKED,
				done
			);
		}
	);

	it('should not allow to update category when adding parent to a root category', function(done) {
		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: { name: 'invalid', isRoot: true } },
			null,
			null,
			{ name: 'correct', parentId: 7 },
			400,
			PARENT_ID_INCLUDED,
			done
		);
	});

	it('should allow to update category when adding parent to a root category and setting it as non-root', function(done) {
		var categoryName = 'correct';
		var parentId = 7;

		var categoriesRequest = {
			query: '?lifecycleStatus=Launched&name=' + categoryName + '&parentId=' + parentId,
			status: 200,
			body: []
		};
		var parentCategoryRequest = { status: 200 };

		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: { name: 'invalid', isRoot: true } },
			categoriesRequest,
			parentCategoryRequest,
			{ name: categoryName, parentId: parentId, isRoot: false },
			null,
			null,
			done
		);
	});

	it(
		'should not allow to update category when adding parent to a root category and setting it as non-root and ' +
		'there is already a category with the same properties',
		function(done) {
			var categoryName = 'correct';
			var parentId = 7;

			var categoriesRequest = {
				query: '?lifecycleStatus=Launched&name=' + categoryName + '&parentId=' + parentId,
				status: 200,
				body: [{}]
			};
			var parentCategoryRequest = { status: 200 };

			testUpdateCategory(
				'PATCH',
				true,
				{ status: 200, body: { name: 'invalid', isRoot: true } },
				categoriesRequest,
				parentCategoryRequest,
				{ name: categoryName, parentId: parentId, isRoot: false },
				409,
				CATEGORY_EXISTS,
				done
			);
		}
	);

	it(
		'should not allow to update category when adding parent to a root category and setting it as non-root and ' +
		'existing categories cannot be retrieved',
		function(done) {
			var categoryName = 'correct';
			var parentId = 7;

			var categoriesRequest = {
				query: '?lifecycleStatus=Launched&name=' + categoryName + '&parentId=' + parentId,
				status: 500,
				body: []
			};
			var parentCategoryRequest = { status: 200 };

			testUpdateCategory(
				'PATCH',
				true,
				{ status: 200, body: { name: 'invalid', isRoot: true } },
				categoriesRequest,
				parentCategoryRequest,
				{ name: categoryName, parentId: parentId, isRoot: false },
				500,
				CATEGORIES_CANNOT_BE_CHECKED,
				done
			);
		}
	);

	it('should not allow to update non-root category when parent is not a valid category', function(done) {
		var categoryName = 'correct';
		var parentId = 7;

		var categoriesRequest = {
			query: '?lifecycleStatus=Launched&name=' + categoryName + '&parentId=' + parentId,
			status: 200,
			body: [{}]
		};
		var parentCategoryRequest = { status: 404 };

		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: { name: 'invalid', isRoot: true } },
			categoriesRequest,
			parentCategoryRequest,
			{ name: categoryName, parentId: parentId, isRoot: false },
			400,
			INVALID_CATEGORY_ID + parentId,
			done
		);
	});

	it('should not allow to update non-root category when parent category cannot be retrieved', function(done) {
		var categoryName = 'correct';
		var parentId = 7;

		var categoriesRequest = {
			query: '?lifecycleStatus=Launched&name=' + categoryName + '&parentId=' + parentId,
			status: 200,
			body: [{}]
		};
		var parentCategoryRequest = { status: 500 };

		var errorMsg = CATEGORY_CANNOT_BE_CHECKED[0] + parentId + CATEGORY_CANNOT_BE_CHECKED[1];

		testUpdateCategory(
			'PATCH',
			true,
			{ status: 200, body: { name: 'invalid', isRoot: true } },
			categoriesRequest,
			parentCategoryRequest,
			{ name: categoryName, parentId: parentId, isRoot: false },
			500,
			errorMsg,
			done
		);
	});

	describe('Test index in checkPermissions middleware', function() {
		var helperUrls = {
			catalog: { url: '/catalog', f: 'searchCatalogs' },
			product: { url: '/productSpecification', f: 'searchProducts' },
			offer: { url: '/productOffering', f: 'searchOfferings' }
		};

		var errorRequestHelper = function errorRequestHelper(done, base, url, query) {
			var pathname = helperUrls[base].url;
			url = pathname + '?' + url;

			var indexes = {};
			indexes[helperUrls[base].f] = () => Promise.reject('Error');

			var catalogApi = getCatalogApi({}, {}, {}, {}, indexes);
			var req = {
				method: 'GET',
				apiUrl: url,
				_parsedUrl: {
					pathname: pathname
				},
				query: query
			};

			catalogApi.checkPermissions(req, function() {
				expect(req.apiUrl).toEqual(url);
				done();
			});
		};

		var requestHelper = function requestHelper(done, base, results, url, query, expectedUrl, expectedQuery) {
			var pathname = helperUrls[base].url;
			url = pathname + '?' + url;
			expectedUrl = pathname + '?' + expectedUrl;

			var indexes = {};
			indexes[helperUrls[base].f] = (q) => {
				if (expectedQuery) {
					expect(q).toEqual(expectedQuery);
				}

				return Promise.resolve(results.map((x) => ({ document: { originalId: x } })));
			};
			
			var catalogApi = getCatalogApi({}, {}, {}, {}, indexes);
			var req = {
				method: 'GET',
				apiUrl: url,
				_parsedUrl: {
					pathname: pathname
				},
				query: query
			};

			catalogApi.checkPermissions(req, function() {
				expect(req.apiUrl).toEqual(expectedUrl);
				done();
			});
		};

		it('should not change request URL when catalog index fails', function(done) {
			errorRequestHelper(done, 'catalog', 'relatedParty.id=rock', { 'relatedParty.id': 'rock' });
		});

		// it('should change request URL to not add any id if no catalog results', function(done) {
		// 	requestHelper(
		// 		done,
		// 		'catalog',
		// 		[],
		// 		'relatedParty.id=someother',
		// 		{
		// 			'relatedParty.id': 'someother'
		// 		},
		// 		'id=',
		// 		{
		// 			sort: {
		// 				field: 'lastUpdate',
		// 				direction: 'desc'
		// 			},
		// 			query: {
		// 				AND: { relatedPartyHash: [md5('someother')] }
		// 			}
		// 		}
		// 	);
		// });

		// it('should change request URL to include catalog IDs when relatedParty.id is provided', function(done) {
		// 	requestHelper(
		// 		done,
		// 		'catalog',
		// 		[2, 12],
		// 		'relatedParty.id=rock-8&extraparam=hola&depth=2&fields=name',
		// 		{
		// 			'relatedParty.id': 'rock-8',
		// 			extraparam: 'hola',
		// 			depth: '2',
		// 			fields: 'name'
		// 		},
		// 		'id=2,12&depth=2&fields=name',
		// 		{
		// 			sort: {
		// 				field: 'lastUpdate',
		// 				direction: 'desc'
		// 			},
		// 			query: {
		// 				AND: { relatedPartyHash: [md5('rock-8')] }
		// 			}
		// 		}
		// 	);
		// });

		it('should not change request URL when product index fails', function(done) {
			errorRequestHelper(done, 'product', 'relatedParty.id=rock', { 'relatedParty.id': 'rock' });
		});

		// it('should change request URL to not add any id if no product results', function(done) {
		// 	requestHelper(
		// 		done,
		// 		'product',
		// 		[],
		// 		'relatedParty.id=someother',
		// 		{
		// 			'relatedParty.id': 'someother'
		// 		},
		// 		'id=',
		// 		{
		// 			sort: {
		// 				field: 'lastUpdate',
		// 				direction: 'desc'
		// 			},
		// 			query: {
		// 				AND: { relatedPartyHash: [md5('someother')] }
		// 			}
		// 		}
		// 	);
		// });

		// it('should change request URL to include product IDs when relatedParty.id is provided', function(done) {
		// 	requestHelper(
		// 		done,
		// 		'product',
		// 		[3, 4, 13],
		// 		'relatedParty.id=rock&size=3',
		// 		{
		// 			'relatedParty.id': 'rock',
		// 			size: 3
		// 		},
		// 		'id=3,4,13',
		// 		{
		// 			sort: {
		// 				field: 'lastUpdate',
		// 				direction: 'desc'
		// 			},
		// 			query: {
		// 				AND: { relatedPartyHash: [md5('rock')] }
		// 			}
		// 		}
		// 	);
		// });

		it('should not change request URL when offer index fails', function(done) {
			errorRequestHelper(done, 'offer', 'relatedParty=rock', { relatedParty: 'rock' });
		});

		// it('should request for category', function(done) {
		// 	requestHelper(
		// 		done,
		// 		'offer',
		// 		[],
		// 		'category.id=201',
		// 		{
		// 			'category.id': 201
		// 		},
		// 		'id=',
		// 		{
		// 			sort: {
		// 				field: 'lastUpdate',
		// 				direction: 'desc'
		// 			},
		// 			query: {
		// 				AND: { categoriesId: ['000000000201'] }
		// 			}
		// 		}
		// 	);
		// });

		// it('should request for category name', function(done) {
		// 	requestHelper(
		// 		done,
		// 		'offer',
		// 		[],
		// 		'category.name=TesTCat',
		// 		{
		// 			'category.name': 'TesTCat'
		// 		},
		// 		'id=',
		// 		{
		// 			sort: {
		// 				field: 'lastUpdate',
		// 				direction: 'desc'
		// 			},
		// 			query: {
		// 				AND: { categoriesName: [md5('testcat')] }
		// 			}
		// 		}
		// 	);
		// });

		// it('should change request URL to not add any id if no offer results', function(done) {
		// 	requestHelper(
		// 		done,
		// 		'offer',
		// 		[],
		// 		'relatedParty=someother',
		// 		{
		// 			relatedParty: 'someother'
		// 		},
		// 		'id=',
		// 		{
		// 			sort: {
		// 				field: 'lastUpdate',
		// 				direction: 'desc'
		// 			},
		// 			query: {
		// 				AND: { userId: [md5('someother')] }
		// 			}
		// 		}
		// 	);
		// });

		// it('should change request URL to include offering IDs when the related party is provided', function(done) {
		// 	requestHelper(
		// 		done,
		// 		'offer',
		// 		[9, 11],
		// 		'relatedParty=rock&offset=3&other=test&size=25',
		// 		{
		// 			relatedParty: 'rock',
		// 			offset: 3,
		// 			size: 25,
		// 			other: 'test'
		// 		},
		// 		'id=9,11',
		// 		{
		// 			offset: 3,
		// 			pageSize: 25,
		// 			sort: {
		// 				field: 'lastUpdate',
		// 				direction: 'desc'
		// 			},
		// 			query: {
		// 				AND: { userId: [md5('rock')] }
		// 			}
		// 		}
		// 	);
		// });

		var testQueryAllIndex = function testQueryAllIndex(done, base) {
			requestHelper(done, base, [1, 2], '', {}, 'id=1,2', {
				sort: {
					field: 'lastUpdate',
					direction: 'desc'
				},
				query: { AND: { '*': ['*'] } }
			});
		};

		var testQueryParameters = function testQueryParameters(done, base, params) {
			// Transform object to param=value&param2=value2
			var paramUrl = Object.keys(params)
				.map((key) => key + '=' + params[key])
				.join('&');
			// Transform object to index AND query (String keys must be lower case to perform index search correctly)
			var ANDs = {};
			Object.keys(params).forEach((key) => {
				if (key != 'isBundle') {
					ANDs[key] = [typeof params[key] === 'string' ? params[key].toLowerCase() : params[key]]
				} else {
					ANDs[key] = params[key] == 'true' ? ['t'] : ['f'];
				}
			});

			requestHelper(done, base, [7, 9, 11], paramUrl, params, 'id=7,9,11', {
				sort: {
					field: 'lastUpdate',
					direction: 'desc'
				},
				query: { AND: ANDs }
			});
		};

		// CATALOGS

	// 	it('should change request URL to include catalog IDs when no parameter is provided', function(done) {
	// 		testQueryAllIndex(done, 'catalog');
	// 	});

	// 	it('should change request URL to include catalog IDs when simple lifecycleStatus is provided', function(done) {
	// 		testQueryParameters(done, 'catalog', { lifecycleStatus: 'Active' });
	// 	});

	// 	it('should change request URL to include catalog IDs when multiple lifecycleStatus are provided', function(done) {
	// 		requestHelper(
	// 			done,
	// 			'catalog',
	// 			[7, 9, 11],
	// 			'lifecycleStatus=Active,Disabled',
	// 			{ lifecycleStatus: 'Active,Disabled' },
	// 			'id=7,9,11',
	// 			{
	// 				sort: {
	// 					field: 'lastUpdate',
	// 					direction: 'desc'
	// 				},
	// 				query: [
	// 					{
	// 						AND: { lifecycleStatus: ['active'] }
	// 					},
	// 					{
	// 						AND: { lifecycleStatus: ['disabled'] }
	// 					}
	// 				]
	// 			}
	// 		);
	// 	});

	// 	it('should change request URL to include catalog IDs when name is provided', function(done) {
	// 		testQueryParameters(done, 'catalog', { name: 'CatalogName' });
	// 	});

	// 	it('should change request URL to include catalog IDs when lifecycleStatus and name are provided', function(done) {
	// 		testQueryParameters(done, 'catalog', { lifecycleStatus: 'Obsolete', name: 'CatalogName' });
	// 	});

	// 	// PRODUCTS

	// 	it('should change request URL to include product IDs when no parameter are provided', function(done) {
	// 		testQueryAllIndex(done, 'product');
	// 	});

	// 	it('should change request URL to include product IDs when lifecycleStatus is provided', function(done) {
	// 		testQueryParameters(done, 'product', { lifecycleStatus: 'Enable' });
	// 	});

	// 	it('should change request URL to include product IDs when isBundle is provided', function(done) {
	// 		testQueryParameters(done, 'product', { isBundle: true });
	// 	});

	// 	it('should change request URL to include product IDs when productNumber is provided', function(done) {
	// 		testQueryParameters(done, 'product', { productNumber: 234 });
	// 	});

	// 	it('should change request URL to include product IDs when lifecycleStatus, isBundle and productNumber are provided', function(done) {
	// 		testQueryParameters(done, 'product', { lifecycleStatus: 'Enable', isBundle: false, productNumber: 256 });
	// 	});

	// 	// OFFERINGS

	// 	it('should change request URL to include offer IDs when no parameter are provided', function(done) {
	// 		testQueryAllIndex(done, 'offer');
	// 	});

	// 	it('should change request URL to include offer IDs when lifecycleStatus is provided', function(done) {
	// 		testQueryParameters(done, 'offer', { lifecycleStatus: 'Active' });
	// 	});

	// 	it('should change request URL to include offer IDs when isBundle is provided', function(done) {
	// 		testQueryParameters(done, 'offer', { isBundle: true });
	// 	});

	// 	it('should change request URL to include offer IDs when lifecycleStatus and isBundle are provided', function(done) {
	// 		testQueryParameters(done, 'offer', { lifecycleStatus: 'Obsolete', isBundle: false });
	// 	});
	});

	describe('Post validation', function() {
		var body = {
			id: '1'
		};

		var user = {
			username: 'test',
			partyId: 'test'
		};

		var off = {
			id: '1',
			catalog: '1'
		};

		var upgrade = {
			version: '1.1',
			productSpecCharacteristic: []
		};

		var testPostValidation = function(req, validator, done) {
			var callCallback = (a, b, cb) => {
				cb(null);
			};

			var storeMethods = ['attachProduct', 'attachOffering', 'updateOffering', 'attachUpgradedProduct'];
			var storeClientMock = jasmine.createSpyObj('storeClient', storeMethods);

			storeMethods.forEach((method) => {
				storeClientMock[method].and.callFake(callCallback);
			});

			var storeClient = {
				storeClient: storeClientMock
			};

			var catalogApi = getCatalogApi(storeClient, {}, {}, {}, {
				indexDocument: () => {
					return Promise.resolve();
				},
				updateDocument: () => {
					return Promise.resolve();
				}
			});

			catalogApi.executePostValidation(req, function() {
				validator(storeClientMock);
				done();
			});
		};

		it('should call the store product attachment when a valid product creation request has been redirected', function(done) {
			var req = {
				method: 'POST',
				apiUrl: '/productSpecification',
				body: body,
				user: user
			};

			testPostValidation(
				req,
				(storeMock) => {
					expect(storeMock.attachProduct).toHaveBeenCalledWith(body, user, jasmine.any(Function));
					expect(storeMock.attachOffering).not.toHaveBeenCalled();
					expect(storeMock.updateOffering).not.toHaveBeenCalled();
					expect(storeMock.attachUpgradedProduct).not.toHaveBeenCalled();
				},
				done
			);
		});

		it('should not call the store attachment when the request is not a product creation', function(done) {
			var req = {
				method: 'GET',
				url: '/productSpecification',
				body: body,
				user: user
			};
			testPostValidation(
				req,
				(storeMock) => {
					expect(storeMock.attachProduct).not.toHaveBeenCalled();
					expect(storeMock.attachOffering).not.toHaveBeenCalled();
					expect(storeMock.updateOffering).not.toHaveBeenCalled();
					expect(storeMock.attachUpgradedProduct).not.toHaveBeenCalled();
				},
				done
			);
		});

		it('should call the offering attachment when the request is a product offering creation', function(done) {
			var req = {
				method: 'POST',
				url: '/productOffering',
				apiUrl: '/catalog/productOffering',
				body: body,
				user: user
			};
			testPostValidation(
				req,
				(storeMock) => {
					expect(storeMock.attachProduct).not.toHaveBeenCalled();
					expect(storeMock.attachOffering).toHaveBeenCalledWith(body, user, jasmine.any(Function));
					expect(storeMock.updateOffering).not.toHaveBeenCalled();
					expect(storeMock.attachUpgradedProduct).not.toHaveBeenCalled();
				},
				done
			);
		});

		it('should call the offering update validation when the request is a product offering update', function(done) {
			var req = {
				method: 'PATCH',
				url: '/productOffering/1',
				apiUrl: '/catalog/productOffering/1',
				body: body,
				user: user
			};
			testPostValidation(
				req,
				(storeMock) => {
					expect(storeMock.attachProduct).not.toHaveBeenCalled();
					expect(storeMock.attachOffering).not.toHaveBeenCalled();
					expect(storeMock.updateOffering).toHaveBeenCalledWith(body, user, jasmine.any(Function));
					expect(storeMock.attachUpgradedProduct).not.toHaveBeenCalled();
				},
				done
			);
		});

		it('should create catalog indexes when a new catalog has been created', function(done) {
			var req = {
				method: 'POST',
				url: '/catalog/',
				body: body,
				user: user
			};

			testPostValidation(
				req,
				(storeMock) => {
					expect(storeMock.attachProduct).not.toHaveBeenCalled();
					expect(storeMock.attachOffering).not.toHaveBeenCalled();
					expect(storeMock.updateOffering).not.toHaveBeenCalled();
					expect(storeMock.attachUpgradedProduct).not.toHaveBeenCalled();
				},
				done
			);
		});

		// it('should notify the store when a product upgrade has finished', function(done) {
		// 	var req = {
		// 		method: 'PATCH',
		// 		url: '/productSpecification/1',
		// 		apiUrl: '/catalog/productSpecification/1',
		// 		reqBody: upgrade,
		// 		body: body,
		// 		user: user
		// 	};

		// 	testPostValidation(
		// 		req,
		// 		(storeMock) => {
		// 			expect(storeMock.attachProduct).not.toHaveBeenCalled();
		// 			expect(storeMock.attachOffering).not.toHaveBeenCalled();
		// 			expect(storeMock.updateOffering).not.toHaveBeenCalled();
		// 			expect(storeMock.attachUpgradedProduct).toHaveBeenCalledWith(
		// 				{
		// 					id: '1',
		// 					version: upgrade.version,
		// 					productSpecCharacteristic: upgrade.productSpecCharacteristic
		// 				},
		// 				user,
		// 				jasmine.any(Function)
		// 			);
		// 		},
		// 		done
		// 	);
		// });

		it('should not notify the store when the product PATCH request is not an upgrade', function(done) {
			var req = {
				method: 'PATCH',
				url: '/productSpecification/1',
				reqBody: body,
				body: body,
				user: user
			};

			testPostValidation(
				req,
				(storeMock) => {
					expect(storeMock.attachProduct).not.toHaveBeenCalled();
					expect(storeMock.attachOffering).not.toHaveBeenCalled();
					expect(storeMock.updateOffering).not.toHaveBeenCalled();
					expect(storeMock.attachUpgradedProduct).not.toHaveBeenCalled();
				},
				done
			);
		});
	});

	describe('API Error handler', function() {
		var body = {
			id: '1'
		};

		var user = {
			username: 'test'
		};

		var upgrade = {
			version: '1.1',
			productSpecCharacteristic: []
		};

		var testErrorHandler = function(req, validator, done) {
			var callCallback = (a, b, cb) => {
				cb(null);
			};

			var storeMethods = ['rollbackProduct', 'rollbackProductUpgrade'];
			var storeClientMock = jasmine.createSpyObj('storeClient', storeMethods);

			storeMethods.forEach((method) => {
				storeClientMock[method].and.callFake(callCallback);
			});

			var storeClient = {
				storeClient: storeClientMock
			};

			var catalogApi = getCatalogApi(storeClient, {}, {}, {}, {});

			catalogApi.handleAPIError(req, function() {
				validator(storeClientMock);
				done();
			});
		};

		it('should just call the callback if the error was not related to products', function(done) {
			var req = {
				method: 'POST',
				apiUrl: '/catalog/'
			};

			testErrorHandler(
				req,
				(storeMock) => {
					expect(storeMock.rollbackProduct).not.toHaveBeenCalled();
					expect(storeMock.rollbackProductUpgrade).not.toHaveBeenCalled();
				},
				done
			);
		});

		it('should call product creation rollback if the product creation has failed in the API', function(done) {
			var req = {
				method: 'POST',
				apiUrl: '/productSpecification',
				reqBody: JSON.stringify(body),
				user: user
			};

			testErrorHandler(
				req,
				(storeMock) => {
					expect(storeMock.rollbackProduct).toHaveBeenCalledWith(body, user, jasmine.any(Function));
					expect(storeMock.rollbackProductUpgrade).not.toHaveBeenCalled();
				},
				done
			);
		});

		// fit('should call the product upgrade rollback if the PATCH has failed in the API', function(done) {
		// 	var req = {
		// 		method: 'PATCH',
		// 		apiUrl: '/productSpecification/1',
		// 		reqBody: JSON.stringify(upgrade),
		// 		user: user
		// 	};

		// 	testErrorHandler(
		// 		req,
		// 		(storeMock) => {
		// 			expect(storeMock.rollbackProduct).not.toHaveBeenCalled();
		// 			expect(storeMock.rollbackProductUpgrade).toHaveBeenCalledWith(
		// 				{
		// 					id: '1',
		// 					version: upgrade.version,
		// 					productSpecCharacteristic: upgrade.productSpecCharacteristic
		// 				},
		// 				user,
		// 				jasmine.any(Function)
		// 			);
		// 		},
		// 		done
		// 	);
		// });
	});
});
