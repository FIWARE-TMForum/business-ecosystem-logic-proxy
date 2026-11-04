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
const RETIRE_ERROR = 'Cannot retire a resource spec without retiring all product specs linked with it'

describe('ResourceSpecification API', function() {

    const config = testUtils.getDefaultConfig();
    const SERVER =
        (config.endpoints.resource.appSsl ? 'https' : 'http') +
        '://' +
        config.endpoints.resource.host +
        ':' +
        config.endpoints.resource.port;

    const getResourceSpecAPI = function(tmfUtils, utils) {
        return proxyquire('../../../controllers/tmf-apis/resource', {
            './../../config': config,
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/tmfUtils': tmfUtils,
            './../../lib/utils': utils,
            './../../lib/store': {
                storeClient: { validateResource: (action, resource, user, callback) => callback(null) }
            }
        }).resource;
    };

    const individual = '/party/individual/resourceSpec'
    const path = '/resourceSpecification';
    const apiPath = '/api'
    const seller = {
        id: 'test',
        roles: ['seller'],
        partyId: 'resourceSpec',
    }
    const protocol = config.endpoints.catalog.appSsl ? 'https' : 'http';
    const url = protocol + '://' + config.endpoints.resource.host + ':' + config.endpoints.resource.port; 
    const prodSpecUrl = protocol + '://' + config.endpoints.catalog.host + ':' + config.endpoints.catalog.port;

    beforeEach(function() {
        nock.cleanAll();
    });

    describe('check permissions', function (){
        describe('Not Authenticated Requests', function() {
            const validateLoggedError = function(req, callback) {
                callback({
                    status: 401,
                    message: 'You need to be authenticated to create/update/delete resources'
                });
            };

            const testNotLoggedIn = function(method, done) {
                const utils = {
                    validateLoggedIn: validateLoggedError
                };

                const resourceApi = getResourceSpecAPI( {}, utils);
                const req = {
                    method: method,
                    url: path
                };

                resourceApi.checkPermissions(req, function(err) {
                    expect(err).not.toBe(null);
                    expect(err.status).toBe(401);
                    expect(err.message).toBe('You need to be authenticated to create/update/delete resources');

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

        describe('retrieval', function(){
            function testRetrieveList(query, url, isList, done){
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

                const resourceApi = getResourceSpecAPI( tmfUtils, utils);
                const req = {
                    method: 'GET',
                    query: query,
                    path: url,
                    user: {
                        partyId: '1234'
                    }
                };

                resourceApi.checkPermissions(req, function(_) { 
                    if(isList){
                        expect(filter).toHaveBeenCalledTimes(1)
                        expect(checkRelatedParty).toHaveBeenCalledTimes(1)
                        
                    }else{
                        expect(filter).toHaveBeenCalledTimes(0)
                    }
                })
                done()
            }

            it('should not call filterRelatedPartyFields method', function(done){
                testRetrieveList({fields: 'relatedParty'}, '/test', false, done)
            })
            it('should call filterRelatedPartyFields method with ensureRelatedPartyIncluded as callback', function(done){
                testRetrieveList({fields: 'relatedParty'}, path, true, done)
            })
        })

        describe('create', () => {
            function testCreateSpec(UserInfo, body, hasError, expectedStatus, expectedErr, isOwner, isSeller, checkRole, vNameF, vDescrF, done) {
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
                    hasPartyRole: checkOwnerMethod,
                    validateNameField: (vNameF) ? () => vNameF : ()=> null,
                    validateDescriptionField: (vDescrF) ? () => vDescrF : () => null,
                };

                const resourceAPI = getResourceSpecAPI(tmfUtils, utils);

                const req = {
                    user: UserInfo,
                    method: 'POST',
                    body: JSON.stringify(body),
                    apiUrl: `/${config.endpoints.resource.path}${path}`,
                    url: path,
                    hostname: config.endpoints.service.host,
                    headers: {}
                };

                resourceAPI.checkPermissions(req, (err) => {
                    if (checkRole) {
                        expect(checkOwnerMethod).toHaveBeenCalledWith(req, body.relatedParty, config.roles.seller)

                        if (isOwner) {
                            expect(checkRoleMethod).toHaveBeenCalledWith(req.user, config.roles.seller)
                        }
                        expect(checkRoleMethod.calls.count()).toBe(isOwner ? 1 : 0);
                    }

                    if (!hasError) {
                        expect(err).toBe(null)
                    } else {
                        expect(err.status).toBe(expectedStatus);
                        expect(err.message).toBe(expectedErr);
                    }
                    done();
                });
            }

            it('should create a resource specification successfully', (done) => {
                const basicBody = {
                    id: 'resSpec',
                    name: 'name',
                    validFor: {
                        startDateTime: '2016-07-12T10:56:00'
                    },
                    relatedParty: [{ id: 'test', role: 'Seller', href: SERVER + individual }]
                };

                testCreateSpec(seller, basicBody, false, 200, null, true, true, true, null, null, done)
            })

            it('should raise 422 if name validator fails', (done) => {
                const basicBody = {
                    id: 'resSpec',
                    name: 'invalid name',
                    validFor: {
                        startDateTime: '2016-07-12T10:56:00'
                    },
                    relatedParty: [{ id: 'test', role: 'Seller', href: SERVER + individual }]
                };

                testCreateSpec(seller, basicBody, true, 422, 'error', true, true, true, 'error', null, done)
            })

            it('should raise 422 if description validator fails', (done) => {
                const basicBody = {
                    id: 'resSpec',
                    name: 'name',
                    description: 'invalid description',
                    validFor: {
                        startDateTime: '2016-07-12T10:56:00'
                    },
                    relatedParty: [{ id: 'test', role: 'Seller', href: SERVER + individual }]
                };

                testCreateSpec(seller, basicBody, true, 422, 'descr error', true, true, true, null, 'descr error', done)
            })

            it('should raise a 403 unauthorized error if the user is not the owner', (done) => {
                const basicBody = {
                    id: 'resspec',
                    validFor: {
                        startDateTime: '2016-07-12T10:56:00'
                    },
                    relatedParty: [{ id: 'test3', role: 'Seller', href: SERVER + individual }]
                };
                testCreateSpec(seller, basicBody, true, 403, 'Unauthorized to create non-owned/non-seller resource specs', false, true, true, null, null, done)
            })

            it('should raise an error if the body is not valid', (done) => {
                const invalidBody = 'invalid'
                const resourceAPI = getResourceSpecAPI({}, {});

                const req = {
                    user: seller,
                    method: 'POST',
                    body: invalidBody,
                    apiUrl: `/${config.endpoints.resource.path}${path}`,
                    url: path,
                    hostname: config.endpoints.service.host,
                    headers: {}
                };

                resourceAPI.checkPermissions(req, (err) => {
                    expect(err).toEqual({
                        status: 400,
                        message: 'The provided body is not a valid JSON'
                    })
                    done()
                })
            })
        })

        describe('update', () => {
            function testUpdateSpec(userInfo, resId, prevBody, body, isOwner, errMsg, done, extraNock, vNameF, vDescrF) {
                const checkRoleMethod = jasmine.createSpy();
                checkRoleMethod.and.returnValue(isOwner);
                const checkOwnerMethod = jasmine.createSpy();
                checkOwnerMethod.and.returnValue(isOwner);

                nock(url).get(`${apiPath}${path}/urn:resource-spec:1`).reply(200, prevBody)

                const utils = {
                    validateLoggedIn: (req, callback) => {
                        callback(null);
                    },
                    hasRole: checkRoleMethod
                }

                const tmfUtils = {
                    hasPartyRole: checkOwnerMethod,
                    validateNameField: (vNameF) ? () => vNameF : () => null,
                    validateDescriptionField: (vDescrF) ? () => vDescrF : () => null,
                }

                const serviceAPI = getResourceSpecAPI(tmfUtils, utils);
                const req = {
                    user: userInfo,
                    method: 'PATCH',
                    body: JSON.stringify(body),
                    apiUrl: `/${config.endpoints.resource.path}${path}/${resId}`,
                    url: `${path}/${resId}`,
                    hostname: config.endpoints.service.host,
                    headers: {}
                }

                serviceAPI.checkPermissions(req, (err) => {
                    if (!errMsg) {
                        expect(checkOwnerMethod).toHaveBeenCalledWith(req, prevBody.relatedParty, config.roles.seller)

                        if (isOwner) {
                            expect(checkRoleMethod).toHaveBeenCalledWith(req.user, config.roles.seller)
                        }
                        expect(err).toBe(null)
                    } else {
                        expect(err).toEqual(errMsg)
                    }
                    if (extraNock){
                        extraNock.done()
                    }

                    done()
                })
            }

            const originalParties = [
                { id: 'test', href: 'urn:organization:test', name: 'Seller', role: 'Seller', '@referredType': 'Organization' },
                { id: 'operator', href: 'urn:organization:operator', name: 'Operator', role: 'SellerOperator', '@referredType': 'Organization' }
            ];

            const changedParties = ['id', 'href', 'name', 'role', '@referredType'].map(function(field) {
                return [Object.assign({}, originalParties[0], { [field]: 'changed' }), originalParties[1]];
            });

            [null, false, 0, '', true, 1, 'invalid', {}, [], [null, null], [originalParties[0]],
                originalParties.concat(originalParties[0]), [originalParties[0], originalParties[0]]
            ].concat(changedParties).forEach(function(relatedParty) {
                it('should reject changes to relatedParty: ' + JSON.stringify(relatedParty), function(done) {
                    testUpdateSpec(seller, 'urn:resource-spec:1', {
                        id: 'urn:resource-spec:1',
                        lifecycleStatus: 'Active',
                        relatedParty: originalParties
                    }, { relatedParty: relatedParty }, true, {
                        status: 409,
                        message: 'The field "relatedParty" can not be modified'
                    }, done);
                });
            });

            [originalParties, originalParties.slice().reverse()].forEach(function(relatedParty, index) {
                it('should allow unchanged relatedParty with array order ' + index, function(done) {
                    testUpdateSpec(seller, 'urn:resource-spec:1', {
                        id: 'urn:resource-spec:1',
                        lifecycleStatus: 'Active',
                        relatedParty: originalParties
                    }, { relatedParty: relatedParty }, true, null, done);
                });
            });

            it('should allow a PATCH that omits relatedParty', function(done) {
                testUpdateSpec(seller, 'urn:resource-spec:1', {
                    id: 'urn:resource-spec:1',
                    lifecycleStatus: 'Active',
                    relatedParty: originalParties
                }, { description: 'Updated description' }, true, null, done);
            });

            it('should allow to update a resource specification', (done) => {
                testUpdateSpec(seller, 'urn:resource-spec:1', {
                    id: 'urn:resource-spec:1',
                    lifecycleStatus: 'Active',
                    relatedParty: [{
                        id: 'test',
                        role: 'Seller'
                    }]
                }, {
                    'lifecycleStatus': 'Launched'
                }, true, null, done)
            })

            it('should allow to retire a resource specification', (done) => {
                const prodSpecMock = nock(prodSpecUrl).get(apiPath + '/productSpecification')
                .query({'resourceSpecification.id':'urn:resource-spec:1', fields:'lifecycleStatus'})
                .reply(200, [{id: 'prod', lifecycleStatus: 'Obsolete'}])
                testUpdateSpec(seller, 'urn:resource-spec:1', {
                    id: 'urn:resource-spec:1',
                    lifecycleStatus: 'Launched',
                    relatedParty: [{
                        id: 'test',
                        role: 'Seller'
                    }]
                }, {
                    lifecycleStatus: 'Retired'
                }, true, null, done, prodSpecMock)
            })

            it('should raise 422 if name validator fails', (done) => {
                testUpdateSpec(seller, 'urn:resource-spec:1', {
                    id: 'urn:resource-spec:1',
                    lifecycleStatus: 'Active',
                    relatedParty: [{
                        id: 'test',
                        role: 'Seller'
                    }]
                }, {
                    'lifecycleStatus': 'Launched',
                    'name': 'invalid name'
                }, true, {
                    status: 422,
                    message: 'error'}, done, null, 'error', null)
            })

            it('should raise 422 if description validator fails', (done) => {
                testUpdateSpec(seller, 'urn:resource-spec:1', {
                    id: 'urn:resource-spec:1',
                    lifecycleStatus: 'Active',
                    relatedParty: [{
                        id: 'test',
                        role: 'Seller'
                    }]
                }, {
                    'lifecycleStatus': 'Launched',
                    'name': 'name',
                    'description': 'invalid description'
                }, true, {
                    status: 422,
                    message: 'descr error'}, done, null, null, 'descr error')
            })

            it('should raise 409 if product specs linked with the resource spec are not retired previously', (done) => {
                const prodSpecMock = nock(prodSpecUrl).get(apiPath + '/productSpecification')
                .query({'resourceSpecification.id':'urn:resource-spec:1', fields:'lifecycleStatus'})
                .reply(200, [{id: 'prod', lifecycleStatus: 'Active'}])
                testUpdateSpec(seller, 'urn:resource-spec:1', {
                    id: 'urn:resource-spec:1',
                    lifecycleStatus: 'Launched',
                    relatedParty: [{
                        id: 'test',
                        role: 'Seller'
                    }]
                }, {
                    lifecycleStatus: 'Retired'
                }, true, {
                    status: 409,
                    message: RETIRE_ERROR}, done, prodSpecMock)
            })


            it('should raise a 403 if the user is not authorized to update', (done) => {
                testUpdateSpec(seller, 'urn:resource-spec:1', {
                    id: 'urn:resource-spec:1',
                    lifecycleStatus: 'Active',
                    relatedParty: [{
                        id: 'test3',
                        role: 'Seller'
                    }]
                }, {
                    'lifecycleStatus': 'Launched'
                }, false, {
                    status: 403,
                    message: 'Unauthorized to update non-owned/non-seller resource specs'
                }, done)
            })

            it('should raise a 404 error if the resource specification is not found', (done) => {
                testUpdateSpec(seller, 'urn:resource-spec:2', {}, {
                    'lifecycleStatus': 'Launched'
                }, true, {
                    status: 404,
                    message: 'The required resource does not exist'
                }, done)
            })

            it('should raise a 400 error is an invalid lifecycle is provided', (done) => {
                testUpdateSpec(seller, 'urn:resource-spec:1', {
                    id: 'urn:resource-spec:1',
                    lifecycleStatus: 'Active',
                    relatedParty: [{
                        id: 'test',
                        role: 'Seller'
                    }]
                }, {
                    'lifecycleStatus': 'Retired'
                }, true, {
                    status: 400,
                    message: 'Cannot transition from lifecycle status Active to Retired'
                }, done)
            })
        })

        describe('not allowed method', function (){
            function TestNotAllowedMethod(method, done){
                var resourceApi = getResourceSpecAPI( {}, {});
                var req = {
                    method: method,
                };
                resourceApi.checkPermissions(req, function(err){
                    expect(err.status).toBe(405)
                    expect(err.message).toBe('The HTTP method ' + method + ' is not allowed in the accessed API')
                })
                done()
            }

            it('should raise 405 not allowed method', function(done){
                TestNotAllowedMethod('PUT', done)
                TestNotAllowedMethod('DELETE', done)
            })
        })


    })

})

describe('Resource specification charging validation', function() {
    const config = testUtils.getDefaultConfig();
    const utils = proxyquire('../../../lib/utils', { './../config': config });
    const storeClient = proxyquire('../../../lib/store', {
        './../config': config,
        './utils': utils
    }).storeClient;
    const backend = utils.getAPIURL(config.endpoints.charging.appSsl,
        config.endpoints.charging.host, config.endpoints.charging.port, '');
    const catalog = utils.getAPIURL(config.endpoints.resource.appSsl,
        config.endpoints.resource.host, config.endpoints.resource.port, '');
    const validationPath = config.endpoints.charging.apiPath + '/charging/api/assetManagement/assets/validateResourceJob';
    const user = {
        id: 'provider', partyId: 'provider-party', userId: 'operator', userPartyId: 'operator-party',
        accessToken: 'provider-token', email: 'provider@example.org', displayName: 'Provider',
        roles: [{ name: config.roles.seller }]
    };
    const previous = {
        id: 'resource-1', name: 'Resource', description: 'Original', lifecycleStatus: 'Active',
        relatedParty: [{ id: user.partyId, role: config.roles.seller }],
        specCharacteristic: [{ name: 'Resource Type', valueType: 'string', specCharacteristicValue: [{ value: 'plugin' }] }]
    };
    let api;
    let loggedIn;
    let owner;

    beforeEach(function() {
        nock.cleanAll();
        loggedIn = true;
        owner = true;
        api = proxyquire('../../../controllers/tmf-apis/resource', {
            './../../config': config,
            './../../lib/store': { storeClient: storeClient },
            './../../lib/utils': {
                validateLoggedIn: (req, cb) => cb(loggedIn ? null : { status: 401 }),
                hasRole: () => true
            },
            './../../lib/tmfUtils': {
                hasPartyRole: () => owner,
                validateNameField: () => null,
                validateDescriptionField: () => null
            }
        }).resource;
    });

    afterEach(function() { nock.cleanAll(); });

    function request(method, body) {
        if (method === 'PATCH') {
            nock(catalog).get('/api/resourceSpecification/resource-1').reply(200, previous);
        }
        return {
            method: method, user: user, body: JSON.stringify(body),
            apiUrl: '/resource/resourceSpecification' + (method === 'PATCH' ? '/resource-1' : ''),
            headers: {}
        };
    }

    function validation(action, resource) {
        return nock(backend, { reqheaders: {
            'content-type': 'application/json', authorization: 'Bearer provider-token',
            'x-actor-id': user.id, 'x-party-id': user.partyId,
            'x-user-id': user.userId, 'x-user-party-id': user.userPartyId,
            'x-roles': config.roles.seller.toLowerCase() + ','
        } }).post(validationPath, { action: action, resource: resource });
    }

    [undefined, previous.specCharacteristic].forEach(function(characteristics) {
        it('validates creation with ' + (characteristics ? 'a Resource Type' : 'no Resource Type'), function(done) {
            const body = { name: 'New resource', relatedParty: previous.relatedParty };
            if (characteristics) body.specCharacteristic = characteristics;
            const req = request('POST', body);
            const scope = validation('create', body).reply(200);
            api.checkPermissions(req, function(err) {
                expect(err).toBe(null);
                expect(scope.isDone()).toBe(true);
                expect(req.body).toBe(JSON.stringify(body));
                done();
            });
        });
    });

    [undefined, [], [{ name: 'New characteristic' }]].forEach(function(characteristics) {
        it('validates complete PATCH with characteristics ' + JSON.stringify(characteristics), function(done) {
            const patch = { description: 'Updated', id: 'caller-id' };
            if (characteristics) patch.specCharacteristic = characteristics;
            const proposed = Object.assign({}, previous, patch, { id: previous.id });
            const req = request('PATCH', patch);
            const scope = validation('update', proposed).reply(200);
            api.checkPermissions(req, function(err) {
                expect(err).toBe(null);
                expect(scope.isDone()).toBe(true);
                expect(req.body).toBe(JSON.stringify(patch));
                expect(req.prevBody).toEqual(previous);
                done();
            });
        });
    });

    ['POST', 'PATCH'].forEach(function(method) {
        [400, 403, 409, 422, 500, 201, 202, 204, 'network'].forEach(function(status) {
            it('blocks ' + method + ' on backend result ' + status, function(done) {
                const body = method === 'POST' ? previous : { description: 'Updated' };
                const proposed = Object.assign({}, previous, body);
                const scope = validation(method === 'POST' ? 'create' : 'update', proposed);
                if (status === 'network') scope.replyWithError('connection reset');
                else scope.reply(status, { error: 'Plugin rejected resource' });
                api.checkPermissions(request(method, body), function(err) {
                    const expectedStatus = status === 'network' ? 504 : status < 300 ? 502 : status;
                    expect(err.status).toBe(expectedStatus);
                    expect(err.message).toBe([400, 403, 409, 422].indexOf(status) >= 0
                        ? 'Plugin rejected resource' : 'The server has failed validating the resource specification');
                    done();
                });
            });
        });

        it('skips backend validation for unauthenticated ' + method, function(done) {
            loggedIn = false;
            const scope = validation(method === 'POST' ? 'create' : 'update', previous).reply(200);
            api.checkPermissions(request(method, previous), function(err) {
                expect(err.status).toBe(401);
                expect(scope.isDone()).toBe(false);
                done();
            });
        });

        it('skips backend validation for non-owner ' + method, function(done) {
            owner = false;
            const scope = validation(method === 'POST' ? 'create' : 'update', previous).reply(200);
            api.checkPermissions(request(method, previous), function(err) {
                expect(err.status).toBe(403);
                expect(scope.isDone()).toBe(false);
                done();
            });
        });
    });

    it('waits for backend validation before allowing forwarding', function(done) {
        const scope = validation('create', previous).delay(30).reply(200);
        let completed = false;
        api.checkPermissions(request('POST', previous), function(err) {
            completed = true;
            expect(err).toBe(null);
            expect(scope.isDone()).toBe(true);
            done();
        });
        expect(completed).toBe(false);
    });
});

describe('Resource specification callback flow', function() {
    const kind = 'resource';
    const config = testUtils.getDefaultConfig();
    const utils = proxyquire('../../../lib/utils', { './../config.js': config });
    const storeClient = proxyquire('../../../lib/store', {
        './../config': config, './utils': utils
    }).storeClient;
    const endpoint = config.endpoints[kind];
    const catalog = utils.getAPIURL(endpoint.appSsl, endpoint.host, endpoint.port, '');
    const charging = config.endpoints.charging;
    const backend = utils.getAPIURL(charging.appSsl, charging.host, charging.port, '');
    const jobPath = charging.apiPath + '/charging/api/assetManagement/assets/validate' +
        kind[0].toUpperCase() + kind.slice(1) + 'Job';
    const collection = '/' + kind + 'Specification';
    const user = {
        id: 'provider', partyId: 'party', userId: 'operator', accessToken: 'token',
        email: 'provider@example.org', displayName: 'Provider', roles: [{ name: config.roles.seller }]
    };
    const existing = {
        id: 'spec-1', name: 'Specification', description: 'Original', lifecycleStatus: 'Active',
        relatedParty: [{ id: user.partyId, role: config.roles.seller }],
        specCharacteristic: [{ name: kind === 'service' ? 'Service Type' : 'Resource Type',
            specCharacteristicValue: [{ value: 'plugin' }] }]
    };
    let tmf;
    let api;
    let postLogger;

    beforeEach(function() {
        nock.cleanAll();
        postLogger = jasmine.createSpyObj('postLogger', ['warn']);
        const file = kind === 'service' ? 'serviceCatalog' : 'resource';
        api = proxyquire('../../../controllers/tmf-apis/' + file, {
            './../../config': config,
            './../../lib/logger': { logger: { getLogger: () => postLogger } },
            './../../lib/store': { storeClient: storeClient },
            './../../lib/utils': {
                validateLoggedIn: (req, cb) => cb(null), hasRole: () => true
            },
            './../../lib/tmfUtils': {
                hasPartyRole: () => true, validateNameField: () => null, validateDescriptionField: () => null
            }
        })[file];
        const stubs = {
            './../config': config, './../lib/utils': utils, './../lib/logger': testUtils.emptyLogger,
            './../lib/tmfUtils': { attachRelatedParty: () => Promise.resolve() }
        };
        stubs['./tmf-apis/' + file] = { [file]: api };
        tmf = proxyquire('../../../controllers/tmf', stubs).tmf();
    });
    afterEach(function() { nock.cleanAll(); });

    function hook(action, specification) {
        return nock(backend, { reqheaders: {
            authorization: 'Bearer token', 'x-party-id': user.partyId,
            'x-actor-id': user.id, 'content-type': 'application/json'
        } }).post(jobPath, { action: action, [kind]: specification });
    }

    function run(method, options, done) {
        const isUpdate = method === 'PATCH';
        const path = collection + (isUpdate ? '/' + existing.id : '');
        const proposed = isUpdate ? { description: 'Updated' } : Object.assign({}, existing);
        if (!isUpdate) delete proposed.id;
        const completeProposed = isUpdate ? Object.assign({}, existing, proposed) : proposed;
        const saved = Object.assign({}, existing, proposed, { href: '/saved/spec-1', version: '2.0' });
        const order = [];
        if (isUpdate) nock(catalog).get(endpoint.apiPath + path).reply(200, existing);
        const pre = hook(isUpdate ? 'update' : 'create', completeProposed)
            .reply(options.preFailure ? 422 : 200, () => {
                order.push('pre'); return { error: 'Pre-validation rejected' };
            });
        const catalogStatus = options.writeFailure ? 409 : isUpdate ? 200 : 201;
        const write = nock(catalog)[isUpdate ? 'patch' : 'post'](endpoint.apiPath + path, proposed)
            .reply(catalogStatus, () => {
                order.push('write'); return options.writeFailure ? { error: 'Catalog rejected' } : saved;
            }, { 'content-type': 'application/json', 'x-catalog-response': 'preserved' });
        const postAction = isUpdate ? 'post-update' : 'post-create';
        let post = hook(postAction, saved);
        if (options.networkFailure) post = post.replyWithError('connection reset');
        else post = post.reply(options.postFailure ? (options.postStatus || 422) : 200, () => {
            order.push('post'); return { error: 'Post-action rejected' };
        });
        const req = {
            method: method, user: user, apiUrl: '/' + endpoint.path + path,
            url: '/' + endpoint.path + path, body: JSON.stringify(proposed),
            headers: {}, connection: { remoteAddress: '127.0.0.1' }, get: () => undefined
        };
        const res = jasmine.createSpyObj('res', ['status', 'json', 'setHeader', 'end']);
        res.status.and.returnValue(res);
        res.json.and.callFake((body) => {
            expect(pre.isDone()).toBe(true);
            if (options.preFailure) {
                expect(res.status).toHaveBeenCalledWith(422);
                expect(body.error).toBe('Pre-validation rejected');
                expect(write.isDone()).toBe(false);
                expect(post.isDone()).toBe(false);
                expect(order).toEqual(['pre']);
            } else if (options.writeFailure) {
                expect(res.status).toHaveBeenCalledWith(409);
                expect(body).toEqual({ error: 'Catalog rejected' });
                expect(post.isDone()).toBe(false);
                expect(order).toEqual(['pre', 'write']);
            } else if (options.postFailure || options.networkFailure) {
                expect(res.status).toHaveBeenCalledWith(catalogStatus);
                expect(post.isDone()).toBe(true);
                expect(body).toEqual(saved);
                expect(res.setHeader).toHaveBeenCalledWith('x-catalog-response', 'preserved');
                expect(postLogger.warn.calls.allArgs().some((args) =>
                    args[0].includes(existing.id) && args[0].includes(postAction + ' failed')
                )).toBe(true);
            } else {
                expect(post.isDone()).toBe(true);
                expect(order).toEqual(['pre', 'write', 'post']);
                expect(res.status).toHaveBeenCalledWith(catalogStatus);
                expect(body).toEqual(saved);
                expect(res.setHeader).toHaveBeenCalledWith('x-catalog-response', 'preserved');
            }
            done();
        });
        tmf.checkPermissions(req, res);
    }

    ['POST', 'PATCH'].forEach((method) => {
        it('runs ' + method + ' pre/write/post in order with complete saved payload', (done) => run(method, {}, done));
        it('blocks ' + method + ' on pre-validation rejection', (done) => run(method, { preFailure: true }, done));
        it('skips post-action on failed ' + method + ' write', (done) => run(method, { writeFailure: true }, done));
        it('preserves ' + method + ' success and logs post-action rejection', (done) => run(method, { postFailure: true }, done));
        it('preserves ' + method + ' success and logs post-action network failure', (done) => run(method, { networkFailure: true }, done));
        [500, 502].forEach((status) => {
            it('preserves ' + method + ' success when post-action returns ' + status, (done) =>
                run(method, { postFailure: true, postStatus: status }, done));
        });
    });

    it('calls back without an error when the post-action fails', function(done) {
        const scope = hook('post-create', existing).reply(502, { error: 'Backend unavailable' });
        api.executePostValidation({
            method: 'POST', apiUrl: '/' + endpoint.path + collection,
            status: 201, body: existing, user: user
        }, (err) => {
            expect(err).toBe(null);
            expect(scope.isDone()).toBe(true);
            expect(postLogger.warn).toHaveBeenCalled();
            done();
        });
    });

    ['GET', 'DELETE', 'PUT'].forEach((method) => {
        it('skips post-action for ' + method, function(done) {
            api.executePostValidation({ method: method, apiUrl: '/' + endpoint.path + collection + '/spec-1', status: 200 }, (err) => {
                expect(err).toBe(null);
                done();
            });
        });
    });

    [400, 409, 500].forEach((status) => {
        it('guards against post-actions on failed catalog status ' + status, function(done) {
            api.executePostValidation({ method: 'POST', apiUrl: '/' + endpoint.path + collection, status: status }, (err) => {
                expect(err).toBe(null);
                done();
            });
        });
    });
});
