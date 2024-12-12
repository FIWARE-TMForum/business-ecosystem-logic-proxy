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

	const getServiceSpecAPI = function(storeClient,tmfUtils, utils, async) {
		return proxyquire('../../../controllers/tmf-apis/serviceCatalog', {
			'./../../config': config,
			'./../../lib/logger': testUtils.emptyLogger,
			'./../../lib/store': storeClient,
			'./../../lib/tmfUtils': tmfUtils,
			'./../../lib/utils': utils,
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

				const serviceAPI = getServiceSpecAPI({}, {}, utils);
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

				const serviceAPI = getServiceSpecAPI({}, tmfUtils, utils);
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

		describe('creation', function() {
			function testCreation(UserInfo, body, hasError, expectedStatus, expectedErr, isOwner, isSeller, checkRole, nockBody, done) {
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
				const storeClient = jasmine.createSpyObj('storeClient', ['validateService']);
				storeClient.validateService.and.callFake((data, user, callback) => {
					if(!hasError){
						callback(null, {body: {result: 'correct', 'id': 123, 'message': 'OK'}});
					}
				});
				const serviceAPI = getServiceSpecAPI({ storeClient: storeClient }, tmfUtils, utils);
				const req = {
					user: UserInfo,
					method: 'POST',
					body: JSON.stringify(body),
					apiUrl: '/service'+path,
					url: path,
					hostname: config.endpoints.service.host,
					headers: {}
				};
				serviceAPI.checkPermissions(req, function(err) {
					if (!hasError) {
						expect(checkOwnerMethod).toHaveBeenCalledWith(req, body.relatedParty, 'owner')
						if (isOwner) {
							expect(checkRoleMethod).toHaveBeenCalledWith(req.user, config.oauth2.roles.seller)
						}
						expect(checkRoleMethod.calls.count()).toBe(isOwner ? 1 : 0);
						expect(err).toBe(null)
						expect(storeClient.validateService).toHaveBeenCalledTimes(1)
					} else {
						expect(err.status).toBe(expectedStatus);
						expect(err.message).toBe(expectedErr);
					}
					done();
				});
			}
			it('should create a service specification successfully', function(done) {
				
				const basicBody = {
					"id": "2",
					"version": "1.0",
					"lastUpdate": "2013-04-19T16:42:23-04:00",
					"name": "Basic dataset",
					"description": "An example dataset",
					"isBundle": false,
					"lifecycleStatus": "Active",
					"validFor": {
						"startDateTime": "2013-04-19T16:42:23-04:00",
						"endDateTime": "2013-06-19T00:00:00-04:00",
					},
					"relatedParty": [
						{
							"role": "Owner",
							"id": "test_user",
							"href": "http ://serverLocation:port/partyManagement/partyRole/1234",
						}
					],
					"attachment": [
						{
							"id": "22",
							"href": "http://serverlocation:port/documentManagement/attachment/22",
							"type": "Picture",
							"url": "http://xxxxx",
						}
					],
					"resourceSpecification": [],
					"specCharacteristic": [
						{
							"id": "42",
							"name": "Custom char",
							"description": "Custom characteristic of the service",
							"valueType": "string",
							"configurable": false,
							"validFor": {
								"startDateTime": "2013-04-19T16:42:23-04:00",
								"endDateTime": "",
							},
							"characteristicValueSpecification": [
								{
									"valueType": "string",
									"default": true,
									"value": "Custom value",
									"unitOfMeasure": "",
									"valueFrom": "",
									"valueTo": "",
									"validFor": {
										"startDateTime": "2013-04-19T16:42:23-04:00",
										"endDateTime": "",
									},
								}
							],
						},
						{
							"id": "42",
							"name": "media type",
							"description": "Media type of the service",
							"valueType": "string",
							"configurable": false,
							"validFor": {
								"startDateTime": "2013-04-19T16:42:23-04:00",
								"endDateTime": "",
							},
							"characteristicValueSpecification": [
								{
									"valueType": "string",
									"default": true,
									"value": "application/x-widget",
									"unitOfMeasure": "",
									"valueFrom": "",
									"valueTo": "",
									"validFor": {
										"startDateTime": "2013-04-19T16:42:23-04:00",
										"endDateTime": "",
									},
								}
							],
						},
						{
							"id": "34",
							"name": "Asset type",
							"description": "Type of digital asset being provided",
							"valueType": "string",
							"configurable": false,
							"validFor": {
								"startDateTime": "2013-04-19T16:42:23-04:00",
								"endDateTime": "",
							},
							"characteristicValueSpecification": [
								{
									"valueType": "string",
									"default": true,
									"value": "Widget",
									"unitOfMeasure": "",
									"valueFrom": "",
									"valueTo": "",
									"validFor": {
										"startDateTime": "2013-04-19T16:42:23-04:00",
										"endDateTime": "",
									},
								}
							],
						},
						{
							"id": "34",
							"name": "Location",
							"description": "URL pointing to the digital asset",
							"valueType": "string",
							"configurable": false,
							"validFor": {
								"startDateTime": "2013-04-19T16:42:23-04:00",
								"endDateTime": "",
							},
							"characteristicValueSpecification": [
								{
									"valueType": "string",
									"default": true,
									"value": "http://testlocation.org/media/resources/test_user/widget.wgt",
									"unitOfMeasure": "",
									"valueFrom": "",
									"valueTo": "",
									"validFor": {
										"startDateTime": "2013-04-19T16:42:23-04:00",
										"endDateTime": "",
									},
								}
							],
						},
					],
				};
				
				testCreation(seller, basicBody, false, 200, null, true, true, true, {}, done)
				})

			it('should raise a 403 unauthorized error', function(done) {
				const basicBody = {
					id: 'serviceSpecNotFound',
					validFor: {
						startDateTime: '2016-07-12T10:56:00'
					},
					relatedParty: [{ id: 'test3', role: 'owner', href: SERVER + individual }]
				};
				testCreation(seller, basicBody, true, 403, 'Unauthorized to create non-owned/non-seller service specs', false, true, true, {}, done)
				})

			it('should raise a 422 bundles are not allowed', function(done) {
				const basicBody = {
					id: 'idwithbundle',
					isBundle: true
				};
				testCreation(seller, basicBody, true, 422, 'Service bundles are not supported', true, true, true, {}, done)
			})
		})

		describe('updation', function(){
			function testUpdation(UserInfo, body, hasError, expectedStatus, expectedErr, isOwner, isSeller, checkRole, scope, done) {
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
				const storeClient = jasmine.createSpyObj('storeClient', ['upgradeService']);
				storeClient.upgradeService.and.callFake((data, user, callback) => {
					if(!hasError){
						callback(null, { status: expectedStatus,
							body:body});
					}
				});
				const serviceAPI = getServiceSpecAPI({ storeClient: storeClient }, tmfUtils, utils);
				const req = {
					user: UserInfo,
					method: 'PATCH',
					body: JSON.stringify(body),
					apiUrl: '/service'+path + '/' + body.id,
					url: path + '/' + body.id,
					hostname: config.endpoints.service.host,
					headers: {}
				};
				serviceAPI.checkPermissions(req, function(err) {
					checked=true
					if (scope) {
						expect(scope.isDone()).toBe(true);
					}
					if (!hasError) {
						expect(checkOwnerMethod).toHaveBeenCalledWith(req, body.relatedParty, 'owner')
						if (isOwner) {
							expect(checkRoleMethod).toHaveBeenCalledWith(req.user, config.oauth2.roles.seller)
						}
						expect(checkRoleMethod.calls.count()).toBe(isOwner ? 1 : 0);
						expect(err).toBe(null)
						expect(storeClient.upgradeService).toHaveBeenCalledWith({id: body.id, version: body.version, specCharacteristic: body.specCharacteristic}, req.user, jasmine.any(Function))
					} else {
						expect(err.status).toBe(expectedStatus);
						expect(err.message).toBe(expectedErr);
					}
					done();
				});
			}
			const basicBody = {
				"id": "123",
				"version": "2.0",
				"lifecycleStatus": "Launched",
				"specCharacteristic": [
					{
						"id": "42",
						"name": "Custom char",
						"description": "Custom characteristic of the service",
						"valueType": "string",
						"configurable": false,
						"validFor": {
							"startDateTime": "2013-04-19T16:42:23-04:00",
							"endDateTime": "",
						},
						"characteristicValueSpecification": [
							{
								"valueType": "string",
								"default": true,
								"value": "Custom value",
								"unitOfMeasure": "",
								"valueFrom": "",
								"valueTo": "",
								"validFor": {
									"startDateTime": "2013-04-19T16:42:23-04:00",
									"endDateTime": "",
								},
							}
						],
					},
					{
						"id": "42",
						"name": "media type",
						"description": "Media type of the service",
						"valueType": "string",
						"configurable": false,
						"validFor": {
							"startDateTime": "2013-04-19T16:42:23-04:00",
							"endDateTime": "",
						},
						"characteristicValueSpecification": [
							{
								"valueType": "string",
								"default": true,
								"value": "application/x-widget",
								"unitOfMeasure": "",
								"valueFrom": "",
								"valueTo": "",
								"validFor": {
									"startDateTime": "2013-04-19T16:42:23-04:00",
									"endDateTime": "",
								},
							}
						],
					},
					{
						"id": "34",
						"name": "Asset type",
						"description": "Type of digital asset being provided",
						"valueType": "string",
						"configurable": false,
						"validFor": {
							"startDateTime": "2013-04-19T16:42:23-04:00",
							"endDateTime": "",
						},
						"characteristicValueSpecification": [
							{
								"valueType": "string",
								"default": true,
								"value": "Widget",
								"unitOfMeasure": "",
								"valueFrom": "",
								"valueTo": "",
								"validFor": {
									"startDateTime": "2013-04-19T16:42:23-04:00",
									"endDateTime": "",
								},
							}
						],
					},
					{
						"id": "34",
						"name": "Location",
						"description": "URL pointing to the digital asset",
						"valueType": "string",
						"configurable": false,
						"validFor": {
							"startDateTime": "2013-04-19T16:42:23-04:00",
							"endDateTime": "",
						},
						"characteristicValueSpecification": [
							{
								"valueType": "string",
								"default": true,
								"value": "http://testlocation.org/media/resources/test_user/widget.wgt",
								"unitOfMeasure": "",
								"valueFrom": "",
								"valueTo": "",
								"validFor": {
									"startDateTime": "2013-04-19T16:42:23-04:00",
									"endDateTime": "",
								},
							}
						],
					},
					{
						"id": "34",
						"name": "Asset",
						"description": "ID of the asset",
						"valueType": "string",
						"configurable": false,
						"validFor": {
							"startDateTime": "2013-04-19T16:42:23-04:00",
							"endDateTime": "",
						},
						"characteristicValueSpecification": [
							{
								"valueType": "string",
								"default": true,
								"value": "61004aba5e05acc115f022f0",
								"unitOfMeasure": "",
								"valueFrom": "",
								"valueTo": "",
								"validFor": {
									"startDateTime": "2013-04-19T16:42:23-04:00",
									"endDateTime": "",
								},
							}
						],
					},
				],
			}
			it('should update a service specification successfully', function(done) {
				const scope = nock(url).get(path + '/' + basicBody.id).reply(200, {id: basicBody.id, version: 1.0, specCharacteristic: basicBody.specCharacteristic, lifecycleStatus: "Active"})
				testUpdation(seller, basicBody, false, 200, null, true, true, true, scope, done)
			})

			it('should raise 422 has not digital asset', function(done) {
				
				const noDig = {
					id: "123",
					version: "2.0",
					"lifecycleStatus": "Launched",
					"specCharacteristic": [basicBody.specCharacteristic[0], basicBody.specCharacteristic[1]
					],
				}
				const scope = nock(url).get(path + '/' + basicBody.id).reply(200, {id: basicBody.id, version: 1.0, specCharacteristic:basicBody.specCharacteristic, lifecycleStatus: "Active"})
				testUpdation(seller, noDig, true, 422, 'To upgrade service specifications it is required to provide a valid asset info', true, true, true, scope, done)
			})

			it('should raise 422 only digital asset can be modified', function(done) {
				
				const patchBody = {
					id: "123",
					"lifecycleStatus": "Launched",
					"specCharacteristic": [basicBody.specCharacteristic[0]]
				}
				const scope = nock(url).get(path + '/' + basicBody.id).reply(200, {id: basicBody.id, version: 1.0, specCharacteristic:basicBody.specCharacteristic, lifecycleStatus: "Active"})
				testUpdation(seller, patchBody, true, 422, 'Service specification characteristics only can be updated for upgrading digital assets', true, true, true, scope, done)
			})

			it('should raise 422 only digital asset can be modified', function(done) {
				
				const patchBody = {
					version: "2.0",
					id: "123",
					"lifecycleStatus": "Launched",
					"specCharacteristic": [...basicBody.specCharacteristic, basicBody.specCharacteristic[0]]
				}
				const scope = nock(url).get(path + '/' + basicBody.id).reply(200, {id: basicBody.id, version: 1.0, specCharacteristic:basicBody.specCharacteristic, lifecycleStatus: "Active"})
				testUpdation(seller, patchBody, true, 422, 'It is not allowed to update custom characteristics during a service upgrade', true, true, true, scope, done)
			})
			it('should raise 400 if lifecycle status are incorrect', function(done) {
				
				const patchBody = {
					id: "123",
					"lifecycleStatus": "Active",
					"specCharacteristic": [...basicBody.specCharacteristic]
				}
				const scope = nock(url).get(path + '/' + basicBody.id).reply(200, {id: basicBody.id, version: 1.0, specCharacteristic:basicBody.specCharacteristic, lifecycleStatus: "Launched"})
				testUpdation(seller, patchBody, true, 400, `Cannot transition from lifecycle status Launched to Active`, true, true, true, scope, done)
			})
			it('should raise 403 if version not found during asset upgrading', function(done) {
				
				const patchBody = {
					id: "123",
					"lifecycleStatus": "Launched",
					"specCharacteristic": [...basicBody.specCharacteristic]
				}
				const scope = nock(url).get(path + '/' + basicBody.id).reply(200, {id: basicBody.id, version: 1.0, specCharacteristic:basicBody.specCharacteristic, lifecycleStatus: "Active"})
				testUpdation(seller, patchBody, true, 403, 'Digital service spec must include the version', true, true, true, scope, done)
			})

			it('should raise a 403 unauthorized to update list', function(done) {
				const basicBody = {
					id: '',
				};
				const scope = nock(url).get(path + '/' + basicBody.id).reply(200, {id: basicBody.id, version: 1.0, specCharacteristic:basicBody.specCharacteristic, lifecycleStatus: "Active"})
				testUpdation(seller, basicBody, true, 403, 'It is not allowed to update a list', false, true, true, scope, done)
			})

			it('should raise a 403 unauthorized error', function(done) {
				const basicBody = {
					id: 'serviceSpecNotFound',
				};
				const scope = nock(url).get(path + '/' + basicBody.id).reply(200, {id: basicBody.id, version: 1.0, specCharacteristic: basicBody.specCharacteristic})
				testUpdation(seller, basicBody, true, 403, 'Unauthorized to update non-owned/non-seller services', false, true, true, scope, done)
			})

			it('should raise a 422 bundles are not allowed while updating', function(done) {
				const basicBody = {
					id: 'idwithbundle',
					isBundle: true
				};
				const scope = nock(url).get(path + '/' + basicBody.id).reply(200, {id: basicBody.id, version: 1.0, specCharacteristic:basicBody.specCharacteristic, lifecycleStatus: "Active"})
				testUpdation(seller, basicBody, true, 422, 'Service bundles are not supported', false, true, true, scope, done)
			})
			it('should raise a 404 not found error while updating', function(done) {
				const basicBody = {
					id: 'serviceSpecNotFound',
				};
				
				const scope = nock(url).get(path + '/' + basicBody.id).reply(404)
				testUpdation(seller, basicBody, true, 404, 'The required service does not exist', true, true, false, scope, done)
			})

			it('should raise a 500 internal error while updating', function(done) {
				const basicBody = {
					id: 'serviceSpecNotFound',
				};
				// returning other status different from 500 and 404
				const scope = nock(url).get(path + '/' + basicBody.id).reply(423)
				testUpdation(seller, basicBody, true, 500, 'The required service cannot be created/updated', true, true, false, scope, done)
			})
		})

		describe('not allowed method', function() {
			function testNotAllowedMethod(method, done) {
				var serviceAPI = getServiceSpecAPI({}, {}, {});
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
