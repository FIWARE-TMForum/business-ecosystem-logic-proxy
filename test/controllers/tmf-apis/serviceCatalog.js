var nock = require('nock');

var proxyquire = require('proxyquire');

var testUtils = require('../../utils');
describe('ServiceSpecification API', function() {

	var config = testUtils.getDefaultConfig();
	var SERVER = (config.endpoints.service.appSsl ? 'https' : 'http') + '://' + config.endpoints.service.host + ':' + config.endpoints.service.port;

	var getServiceSpecAPI = function(tmfUtils, utils) {
		return proxyquire('../../../controllers/tmf-apis/serviceCatalog', {
			'./../../config': config,
			'./../../lib/logger': testUtils.emptyLogger,
			'./../../lib/tmfUtils': tmfUtils,
			'./../../lib/utils': utils
		}).serviceCatalog;
	};
	var individual = '/party/individual/serviceSpec';
	var path = '/serviceSpecification';
	var seller = {
		id: 'test',
		roles: ['seller'],
		partyId: 'serviceSpec',
	}
	var nonSeller = {
		id: 'test2',
	}
	var protocol = config.endpoints.service.appSsl ? 'https' : 'http';
	var url = protocol + '://' + config.endpoints.service.host + ':' + config.endpoints.service.port;

	beforeEach(function() {
		nock.cleanAll();
	});

	describe('check permissions', function() {
		describe('Not Authenticated Requests', function() {
			var validateLoggedError = function(req, callback) {
				callback({
					status: 401,
					message: 'You need to be authenticated to create/update/delete services'
				});
			};

			var testNotLoggedIn = function(method, done) {
				var utils = {
					validateLoggedIn: validateLoggedError
				};

				var serviceAPI = getServiceSpecAPI({}, utils);
				var req = {
					method: method,
					url: path
				};

				serviceAPI.checkPermissions(req, function(err) {
					expect(err).not.toBe(null);
					expect(err.status).toBe(401);
					expect(err.message).toBe('You need to be authenticated to create/update/delete services');

					done();
				});
			};

			it('should reject not authenticated GET requests', function(done) {
				testNotLoggedIn('GET', done);
			});

			it('should reject not authenticated POST requests', function(done) {
				testNotLoggedIn('POST', done);
			});

			it('should reject not authenticated PATCH requests', function(done) {
				testNotLoggedIn('PATCH', done);
			});
		});
		describe('retrieval', function() {
			function testRetrieveList(query, url, isList, done) {
				var checkRelatedParty = jasmine.createSpy();
				checkRelatedParty.and.callFake((req, callback) => callback(null));
				var filter = jasmine.createSpy();
				filter.and.callFake((req, callback) => callback(null));
				var utils = {
					validateLoggedIn: function(req, callback) {
						callback(null);
					}
				};
				var tmfUtils = {
					ensureRelatedPartyIncluded: checkRelatedParty,
					filterRelatedPartyFields: filter
				}
				var serviceAPI = getServiceSpecAPI(tmfUtils, utils);
				var req = {
					method: 'GET',
					query: query,
					path: url
				};
				serviceAPI.checkPermissions(req, function(_) {
					if (isList) {
						expect(filter).toHaveBeenCalledTimes(1);
						expect(checkRelatedParty).toHaveBeenCalledTimes(1);
					} else {
						expect(filter).toHaveBeenCalledTimes(0);
					}
				})
				done()
			}
			it('should not call filterRelatedPartyFields method', function(done) {
				testRetrieveList({ fields: 'relatedParty' }, '/test', false, done)
			})
			it('should call filterRelatedPartyFields method with ensureRelatedPartyIncluded as callback', function(done) {
				testRetrieveList({ fields: 'relatedParty' }, path, true, done)
			})

			function testRetrieveSingle(url, body, isArray, isCustomer, n, done) {
				var checkOwnerMethod = jasmine.createSpy();
				checkOwnerMethod.and.returnValue(isCustomer);
				var utils = {
					validateLoggenIn: function(req, callback) {
						callback(null);
					}
				};
				var tmfUtils = {
					hasPartyRole: checkOwnerMethod
				};
				var serviceAPI = getServiceSpecAPI(tmfUtils, utils);
				var req = {
					method: 'GET',
					path: url,
					body: body
				};
				serviceAPI.executePostValidation(req, function(err) {
					if (!isArray && !isCustomer) {
						expect(err.status).toBe(403)
						expect(err.message).toBe('You are not authorized to retrieve the specified service specification from the catalog')
					}
					expect(checkOwnerMethod).toHaveBeenCalledTimes(n)
				})
				done()
			}
			it('should raise 403 auth error', function(done) {
				testRetrieveSingle(url, {}, false, false, 1, done)
			})
			it('should call hasPartyRole method', function(done) {
				testRetrieveSingle(url, {}, false, true, 1, done)
			})
			it('should call hasPartyRole method', function(done) {
				testRetrieveSingle(url, [], true, false, 0, done)
			})
			it('should call hasPartyRole method', function(done) {
				testRetrieveSingle(url, [], true, false, 0, done)
			})
		})
		describe('creation/updation', function() {
			function testCreationUpdation(UserInfo, body, hasError, expectedStatus, expectedErr, isOwner, isSeller, checkRole, method, nockBody, done) {
				var checkRoleMethod = jasmine.createSpy();
				checkRoleMethod.and.returnValue(isSeller);
				var checkOwnerMethod = jasmine.createSpy();
				checkOwnerMethod.and.returnValue(isOwner);
				var utils = {
					validateLoggedIn: function(req, callback) {
						callback(null);
					},
					hasRole: checkRoleMethod
				};
				var tmfUtils = {
					hasPartyRole: checkOwnerMethod
				};
				var serviceAPI = getServiceSpecAPI(tmfUtils, utils);
				var req = {
					user: UserInfo,
					method: method,
					body: JSON.stringify(body),
					apiUrl: path,
					url: path,
					hostname: config.endpoints.service.host,
					headers: {}
				};
				serviceAPI.checkPermissions(req, function(err) {
					if (checkRole) {
						if (method === 'PATCH') {
							expect(checkOwnerMethod).toHaveBeenCalledWith(req, nockBody.relatedParty, 'owner')
						} else {
							expect(checkOwnerMethod).toHaveBeenCalledWith(req, body.relatedParty, 'owner')
						}
						if (isOwner) {
							expect(checkRoleMethod).toHaveBeenCalledWith(req.user, config.oauth2.roles.seller)
						}
						expect(checkRoleMethod.calls.count()).toBe(isOwner ? 1 : 0);
					}
					if (!hasError) {
						expect(err).toBe(null)
					} else {
						expect(err.status).toBe(expectedStatus);
						expect(err.message).toBe(expectedErr);
					}
				});
				done();
			}
			it('should create a service specification successfully', function(done) {
				const basicBody = {
					id: 'sericeSpec',
					validFor: {
						startDateTime: '2016-07-12T10:56:00'
					},
					relatedParty: [{ id: 'test', role: 'owner', href: SERVER + individual }]
				};
				nockBody = { id: 'test', relatedParty: [] }
				testCreationUpdation(seller, basicBody, false, 200, null, true, true, true, 'POST', nockBody, done)
				nock(url).get(path).reply(200, nockBody)
				testCreationUpdation(seller, basicBody, false, 200, null, true, true, true, 'PATCH', nockBody, done)
			})

			it('should raise a 404 not found error', function(done) {
				const basicBody = {
					id: 'serviceSpecNotFound',
				};
				nock(url).get(path).reply(404, {})
				testCreationUpdation(seller, basicBody, true, 404, 'The required service does not exist', true, true, false, 'PATCH', {}, done)
			})

			it('should raise a 500 internal error', function(done) {
				const basicBody = {
					id: 'serviceSpecNotFound',
				};
				// returning other status different from 500 and 404
				nock(url).get(path).reply(423, {})
				testCreationUpdation(seller, basicBody, true, 500, 'The required service cannot be created/updated', true, true, false, 'PATCH', {}, done)
			})

			it('should raise a 403 unauthorized error', function(done) {
				const basicBody = {
					id: 'serviceSpecNotFound',
				};
				testCreationUpdation(seller, basicBody, true, 403, 'Unauthorized to create non-owned/non-seller service specs', false, true, true, 'POST', {}, done)
				nock(url).get(path).reply(200, {})
				testCreationUpdation(seller, basicBody, true, 403, 'Unauthorized to update non-owned/non-seller services', false, true, true, 'PATCH', {}, done)
			})
		})
		describe('not allowed method', function() {
			function testNotAllowedMethod(method, done) {
				var serviceAPI = getServiceSpecAPI({}, {});
				var req = {
					method: method,
				};
				serviceAPI.checkPermissions(req, function(err) {
					expect(err.status).toBe(405)
					expect(err.message).toBe('The HTTP method ' + method + ' is not allowed in the accessed API')
				})
				done()
			}
			it('should raise 405 not allowed method', function(done) {
				testNotAllowedMethod('PUT', done)
				testNotAllowedMethod('DELETE', done)
			})
		})
	})
})
