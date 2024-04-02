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
            './../../lib/utils': utils
        }).resource;
    };

    const individual = '/party/individual/resourceSpec'
    const path = '/resourceSpecification';
    const seller = {
        id: 'test',
        roles: ['seller'],
        partyId: 'resourceSpec',
    }
    const protocol = config.endpoints.catalog.appSsl ? 'https' : 'http';
	const url = protocol + '://' + config.endpoints.resource.host + ':' + config.endpoints.resource.port; 
    
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

        describe('creation/updation', function() {
            function testCreationUpdation (userInfo, body, hasError, expectedStatus, expectedErr, isOwner, isSeller, checkRole, method, nockBody,done) {
                var checkRoleMethod = jasmine.createSpy();
                checkRoleMethod.and.returnValue(isSeller);
                var checkOwnerMethod = jasmine.createSpy();
                checkOwnerMethod.and.returnValue(isOwner);
                var utils = {
                    validateLoggedIn: function (req, callback){callback(null)},  
                    hasRole: checkRoleMethod
                };
                var tmfUtils = {       
                    hasPartyRole: checkOwnerMethod
                };
                var resourceApi = getResourceSpecAPI( tmfUtils, utils);
                var req = {
                    user: userInfo,
                    method: method,
                    body: JSON.stringify(body),
                    apiUrl: path,
                    url: path,
                    hostname: config.endpoints.resource.host,
                    headers: {}
                };

                resourceApi.checkPermissions(req, function(err) {
                    if(checkRole){
                        if(method === 'PATCH')
                            expect(checkOwnerMethod).toHaveBeenCalledWith(req, nockBody.relatedParty, 'owner')
                        else
                            expect(checkOwnerMethod).toHaveBeenCalledWith(req, body.relatedParty, 'owner')

                        if(isOwner){
                            expect(checkRoleMethod).toHaveBeenCalledWith(req.user, config.oauth2.roles.seller)
                        }
                        expect(checkRoleMethod.calls.count()).toBe(isOwner ? 1 : 0);
                    }
                    if(!hasError){
                        expect(err).toBe(null)
                    }else {
                        expect(err.status).toBe(expectedStatus);
                        expect(err.message).toBe(expectedErr);
                    }
                });
                done();
            }
            it('should create a resource specification successfully', function(done){
                const basicBody = {
                    id: 'resourceSpec',
                    validFor: {
                        startDateTime: '2016-07-12T10:56:00'
                    },
                    relatedParty: [{id:'test', role: 'owner', href: SERVER + individual}]
                };
                nockBody = {id: 'test', relatedParty: []}
                testCreationUpdation(seller, basicBody, false, 200, null, true, true, true, 'POST', nockBody, done)
                nock(url).get(path).reply(200, nockBody)
                testCreationUpdation(seller, basicBody, false, 200, null, true, true, true, 'PATCH', nockBody, done)
            })

            it('should raise a 404 not found error', function(done){
                const basicBody = {
                    id: 'resourceSpecNotFound',
                };
                nock(url).get(path).reply(404, {})
                testCreationUpdation(seller, basicBody, true, 404, 'The required resource does not exist', true, true, false, 'PATCH', {}, done)
            })

            it('should raise a 500 internal error', function(done){
                const basicBody = {
                    id: 'resourceSpecNotFound',
                };
                // returning other status different from 500 and 404
                nock(url).get(path).reply(423, {})
                testCreationUpdation(seller, basicBody, true, 500, 'The required resource cannot be created/updated', true, true, false, 'PATCH', {}, done)
            })

            it('should raise a 403 unauthorized error', function(done){
                const basicBody = {
                    id: 'resourceSpecNotFound',
                };
                testCreationUpdation(seller, basicBody, true, 403, 'Unauthorized to create non-owned/non-seller resources', false, true, true, 'POST', {}, done)
                nock(url).get(path).reply(200, {})
                testCreationUpdation(seller, basicBody, true, 403, 'Unauthorized to update non-owned/non-seller resources', false, true, true, 'PATCH', {}, done)
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