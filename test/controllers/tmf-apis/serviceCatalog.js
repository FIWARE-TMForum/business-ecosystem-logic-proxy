/* Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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

const nock = require('nock');
const proxyquire = require('proxyquire');
const testUtils = require('../../utils');

describe('ServiceSpecification API', function() {

	const config = testUtils.getDefaultConfig();
	const SERVER = (config.endpoints.service.appSsl ? 'https' : 'http') + '://' + config.endpoints.service.host + ':' + config.endpoints.service.port;

	const getServiceSpecAPI = function(tmfUtils, utils) {
		return proxyquire('../../../controllers/tmf-apis/serviceCatalog', {
			'./../../config': config,
			'./../../lib/logger': testUtils.emptyLogger,
			'./../../lib/tmfUtils': tmfUtils,
			'./../../lib/utils': utils
		}).serviceCatalog;
	};

	const individual = '/party/individual/serviceSpec';
	const path = '/serviceSpecification';
	const seller = {
		id: 'test',
		roles: ['seller'],
		partyId: 'testParty',
	}
	const protocol = config.endpoints.service.appSsl ? 'https' : 'http';
	const url = protocol + '://' + config.endpoints.service.host + ':' + config.endpoints.service.port;

	beforeEach(function() {
		nock.cleanAll();
	});

	describe('check permissions', function() {
		describe('Not Authenticated Requests', function() {
			const validateLoggedError = function(req, callback) {
				callback({
					status: 401,
					message: 'You need to be authenticated to create/update/delete services'
				});
			};

			const testNotLoggedIn = function(method, done) {
				const utils = {
					validateLoggedIn: validateLoggedError
				};

				const serviceAPI = getServiceSpecAPI({}, utils);
				const req = {
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

			it('should reject not authenticated POST requests', function(done) {
				testNotLoggedIn('POST', done);
			});

			it('should reject not authenticated PATCH requests', function(done) {
				testNotLoggedIn('PATCH', done);
			});
		});

		describe('retrieval', function() {
			function testRetrieveList(query, url, isList, done) {
				const checkRelatedParty = jasmine.createSpy();
				checkRelatedParty.and.callFake((req, callback) => callback(null));

				const filter = jasmine.createSpy();
				filter.and.callFake((req, callback) => callback(null));

				const utils = {
					validateLoggedIn: function(req, callback) {
						callback(null);
					}
				};

				const tmfUtils = {
					ensureRelatedPartyIncluded: checkRelatedParty,
					filterRelatedPartyFields: filter
				}

				const serviceAPI = getServiceSpecAPI(tmfUtils, utils);
				const req = {
					method: 'GET',
					query: query,
					path: url,
					user: {
						partyId: '1234'
					}
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
		})

		describe('create', () => {
			function testCreateSpec(UserInfo, body, hasError, expectedStatus, expectedErr, isOwner, isSeller, checkRole, done) {
				const checkRoleMethod = jasmine.createSpy();
				checkRoleMethod.and.returnValue(isSeller);

				const checkOwnerMethod = jasmine.createSpy();
				checkOwnerMethod.and.returnValue(isOwner);

				const utils = {
					validateLoggedIn: function(req, callback) {
						callback(null);
					},
					hasRole: checkRoleMethod
				};

				const tmfUtils = {
					hasPartyRole: checkOwnerMethod
				};

				const serviceAPI = getServiceSpecAPI(tmfUtils, utils);

				const req = {
					user: UserInfo,
					method: 'POST',
					body: JSON.stringify(body),
					apiUrl: path,
					url: path,
					hostname: config.endpoints.service.host,
					headers: {}
				};

				serviceAPI.checkPermissions(req, (err) => {
					if (checkRole) {
						expect(checkOwnerMethod).toHaveBeenCalledWith(req, body.relatedParty, 'owner')
						
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

			it('should create a service specification successfully', (done) => {
				const basicBody = {
					id: 'sericeSpec',
					validFor: {
						startDateTime: '2016-07-12T10:56:00'
					},
					relatedParty: [{ id: 'test', role: 'owner', href: SERVER + individual }]
				};

				testCreateSpec(seller, basicBody, false, 200, null, true, true, true, done)
			})

			it('should raise a 403 unauthorized error if the user is not the owner', (done) => {
				const basicBody = {
					id: 'serviceSpecNotFound',
					validFor: {
						startDateTime: '2016-07-12T10:56:00'
					},
					relatedParty: [{ id: 'test3', role: 'owner', href: SERVER + individual }]
				};
				testCreateSpec(seller, basicBody, true, 403, 'Unauthorized to create non-owned/non-seller service specs', false, true, true, done)
			})

			it('should raise an error if the body is not valid', (done) => {
				const invalidBody = 'invalid'
				const serviceAPI = getServiceSpecAPI({}, {});

				const req = {
					user: seller,
					method: 'POST',
					body: invalidBody,
					apiUrl: path,
					url: path,
					hostname: config.endpoints.service.host,
					headers: {}
				};

				serviceAPI.checkPermissions(req, (err) => {
					expect(err).toEqual({
						status: 400,
						message: 'The provided body is not a valid JSON'
					})
					done()
				})
			})
		})

		describe('update', () => {
			function testUpdateService(userInfo, serviceId, prevBody, body, isOwner, errMsg, done) {
				const checkRoleMethod = jasmine.createSpy();
				checkRoleMethod.and.returnValue(isOwner);
				const checkOwnerMethod = jasmine.createSpy();
				checkOwnerMethod.and.returnValue(isOwner);

				nock(url).get(`${path}/urn:service-spec:1`).reply(200, prevBody)

				const utils = {
					validateLoggedIn: (req, callback) => {
						callback(null);
					},
					hasRole: checkRoleMethod
				}

				const tmfUtils = {
					hasPartyRole: checkOwnerMethod
				}

				const serviceAPI = getServiceSpecAPI(tmfUtils, utils);
				const req = {
					user: userInfo,
					method: 'PATCH',
					body: JSON.stringify(body),
					apiUrl: `${path}/${serviceId}`,
					url: `${path}/${serviceId}`,
					hostname: config.endpoints.service.host,
					headers: {}
				}

				serviceAPI.checkPermissions(req, (err) => {
					if (!errMsg) {
						expect(checkOwnerMethod).toHaveBeenCalledWith(req, prevBody.relatedParty, 'owner')

						if (isOwner) {
							expect(checkRoleMethod).toHaveBeenCalledWith(req.user, config.oauth2.roles.seller)
						}
						expect(err).toBe(null)
					} else {
						expect(err).toEqual(errMsg)
					}

					done()
				})
			}

			it('should allow to update a service specification', (done) => {
				testUpdateService(seller, 'urn:service-spec:1', {
					id: 'urn:service-spec:1',
					lifecycleStatus: 'Active',
					relatedParty: [{
						id: 'test',
						role: 'owner'
					}]
				}, {
					'lifecycleStatus': 'Launched'
				}, true, null, done)
			})

			it('should raise a 403 if the user is not authorized to update', (done) => {
				testUpdateService(seller, 'urn:service-spec:1', {
					id: 'urn:service-spec:1',
					lifecycleStatus: 'Active',
					relatedParty: [{
						id: 'test3',
						role: 'owner'
					}]
				}, {
					'lifecycleStatus': 'Launched'
				}, false, {
					status: 403,
					message: 'Unauthorized to update non-owned/non-seller services'
				}, done)
			})

			it('should raise a 404 error if the service specification is not found', (done) => {
				testUpdateService(seller, 'urn:service-spec:2', {}, {
					'lifecycleStatus': 'Launched'
				}, true, {
					status: 404,
					message: 'The required service does not exist'
				}, done)
			})

			it('should raise a 400 error is an invalid lifecycle is provided', (done) => {
				testUpdateService(seller, 'urn:service-spec:1', {
					id: 'urn:service-spec:1',
					lifecycleStatus: 'Active',
					relatedParty: [{
						id: 'test',
						role: 'owner'
					}]
				}, {
					'lifecycleStatus': 'Retired'
				}, true, {
					status: 400,
					message: 'Cannot transition from lifecycle status Active to Retired'
				}, done)
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
