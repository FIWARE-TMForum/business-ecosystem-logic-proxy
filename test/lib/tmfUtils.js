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

const proxyquire = require('proxyquire');
const testUtils = require('../utils');

describe('TMF Utils', function() {
    const config = testUtils.getDefaultConfig();

    const getTmfUtils = function(utils) {
        return proxyquire('../../lib/tmfUtils', {
            './../config': config,
            './utils': utils || {}
        });
    };

    const getPartyHref = function(protocol, hostname, userName) {
        return (
            protocol +
            '://' +
            hostname +
            ':' +
            config.port +
            '/' +
            config.endpoints.party.path +
            '/individual/' +
            userName
        );
    };

    describe('Is Owner', function() {
        const testIsOwner = function(req, info, expected) {
            var tmfUtils = getTmfUtils();

            var result = tmfUtils.isOwner(req, info);
            expect(result).toBe(expected);
        };

        it('should return true when the user is owner of the given resource', function() {
            const userName = 'test';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    roles: [],
                    partyId: userName
                }
            };

            const info = {
                relatedParty: [
                    {
                        role: 'Owner',
                        id: userName,
                        href: getPartyHref('http', req.hostname, userName)
                    }
                ]
            };

            testIsOwner(req, info, true);
        });

        it('should return false when the user is not owner of the resource', function() {
            const userName = 'user';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    roles: [],
                    partyId: 'another_user'
                }
            };

            const info = {
                relatedParty: [
                    {
                        role: 'Owner',
                        id: userName,
                        href: getPartyHref('http', req.hostname, userName)
                    }
                ]
            };

            testIsOwner(req, info, false);
        });

        it('should return false when the resource does not contain related party field', function() {
            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    roles: [],
                    partyId: 'test'
                }
            };

            const info = {};
            testIsOwner(req, info, false);
        });
    });

    describe('Filter Related Party Fields', function() {
        const testFilterRelatedPartyFields = function(user, query, expectedErr, newQueryParams, done) {
            const buildQueryString = function(query) {
                const queryArray = [];

                for (let key in query) {
                    queryArray.push(key + '=' + query[key]);
                }

                return queryArray.join('&');
            };

            let originalApiUrl = '/example/api/path';
            const queryIncluded = query && Object.keys(query).length > 0;

            if (queryIncluded) {
                originalApiUrl += '?' + buildQueryString(query);
            }

            const tmfUtils = getTmfUtils();
            const req = {
                apiUrl: originalApiUrl,
                query: query,
                user: user
            };

            tmfUtils.filterRelatedPartyFields(req, function(err) {
                expect(err).toEqual(expectedErr);

                if (!err) {
                    const newQueryParamsExpected = newQueryParams && Object.keys(newQueryParams).length > 0;
                    let expectedApiUrl = originalApiUrl;

                    if (newQueryParamsExpected) {
                        const separator = queryIncluded ? '&' : '?';
                        expectedApiUrl = originalApiUrl + separator + buildQueryString(newQueryParams);
                    }

                    expect(req.apiUrl).toBe(expectedApiUrl);
                }

                done();
            });
        };

        it('should call callback with error when Related Party field includes href', function(done) {
            const user = {
                partyId: 'fiware'
            };

            const query = {
                'relatedParty.href': 'http://fiware.org/user/fiware'
            };

            const err = {
                status: 403,
                message: 'You are not allowed to filter items using these filters'
            };

            testFilterRelatedPartyFields(user, query, err, null, done);
        });

        it('should call callback with error when Related Party field includes role', function(done) {
            const user = {
                partyId: 'fiware'
            };

            const query = {
                'relatedParty.role': 'Customer'
            };

            const err = {
                status: 403,
                message: 'You are not allowed to filter items using these filters'
            };

            testFilterRelatedPartyFields(user, query, err, null, done);
        });

        it('should call callback with error when asking for items from another user', function(done) {
            const user = {
                partyId: 'fiware'
            };

            const query = {
                'relatedParty.id': user.partyId + 'a'
            };

            const err = {
                status: 403,
                message: 'You are not authorized to retrieve the entities made by the user ' + query['relatedParty.id']
            };

            testFilterRelatedPartyFields(user, query, err, null, done);
        });

        it('should call callback without error when asking for their own items', function(done) {
            const user = {
                partyId: 'fiware'
            };

            const query = {
                'relatedParty.id': user.partyId
            };

            testFilterRelatedPartyFields(user, query, null, null, done);
        });

        it('should include party id when not included in the original request', function(done) {
            const user = {
                partyId: 'fiware'
            };

            const newQueryParams = {
                'relatedParty.id': user.partyId
            };

            testFilterRelatedPartyFields(user, {}, null, newQueryParams, done);
        });

        it('should include party id when not included in the original request and extra query params', function(done) {
            const user = {
                partyId: 'fiware'
            };

            const query = {
                state: 'failed'
            };

            const newQueryParams = {
                'relatedParty.id': user.partyId
            };

            testFilterRelatedPartyFields(user, query, null, newQueryParams, done);
        });
    });

    describe('Ensure Related Party Field', function() {
        const testEnsureRelatedParty = function(originalApiUrl, query, expectedApiUrl) {
            const req = {
                apiUrl: originalApiUrl,
                query: query
            };

            const tmfUtils = getTmfUtils();
            const callback = jasmine.createSpy();

            tmfUtils.ensureRelatedPartyIncluded(req, callback);

            expect(callback).toHaveBeenCalledWith(null);
            expect(req.apiUrl).toBe(expectedApiUrl);
        };

        const urlNotModified = function(originalApiUrl, query) {
            testEnsureRelatedParty(originalApiUrl, query, originalApiUrl);
        };

        const urlNotModifiedFields = function(fields) {
            urlNotModified('/product?fields=' + fields, { fields: fields });
        };

        it('should not modify the API URL when query is not included', function() {
            urlNotModified('/product', {});
        });

        it('should not modify the API URL when query included but fields is not included', function() {
            const name = 'fiware';
            urlNotModified('/product?name=' + name, { name: name });
        });

        it('should not modify the API URL when fields include related party at the beginning', function() {
            const fields = 'relatedParty,name';
            urlNotModifiedFields(fields);
        });

        it('should not modify the API URL when fields include related party at the end', function() {
            const fields = 'relatedParty,name';
            urlNotModifiedFields(fields);
        });

        it('should not modify the API URL when fields include related party in the middle', function() {
            const fields = 'name,relatedParty,version';
            urlNotModifiedFields(fields);
        });

        it(
            'should modify the API URL when related party is not included in the fields query param ' +
                'and there are no more query params',
            function() {
                const fields = 'name';
                const originalApiUrl = '/product?fields=' + fields;
                const expectedApiUrl = originalApiUrl + ',relatedParty';

                testEnsureRelatedParty(originalApiUrl, { fields: fields }, expectedApiUrl);
            }
        );

        it(
            'should modify the API URL when related party is not included in the fields query param ' +
                'and there are more query params',
            function() {
                const version = '1';
                const fields = 'name';

                const urlPattern = '/product?fields=FIELDS&version=' + version;
                const originalApiUrl = urlPattern.replace('FIELDS', fields);
                const expectedApiUrl = urlPattern.replace('FIELDS', fields + ',relatedParty');

                testEnsureRelatedParty(originalApiUrl, { fields: fields, version: version }, expectedApiUrl);
            }
        );
    });

    describe('Has Party Role', function() {
        it('should return false when related Party is empty', function() {
            const tmfUtils = getTmfUtils();
            const result = tmfUtils.hasPartyRole(
                { hostname: 'belp.fiware.org', secure: false, user: { partyId: 'fiware' } },
                [],
                'seller'
            );
            expect(result).toBe(false);
        });

        it('should return true when related Party contains one element and user and role matches', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName
                }
            };

            const relatedParties = [
                {
                    role: role,
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName)
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(true);
        });

        it('should return true when related Party contains one element and user and role (ignore case) matches', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName
                }
            };

            const relatedParties = [
                {
                    role: role.toUpperCase(),
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName)
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role.toLowerCase());
            expect(result).toBe(true);
        });

        it('should return false when related Party contains one element and user matches but role does not', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName
                }
            };

            const relatedParties = [
                {
                    role: role,
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName)
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role + 'a');
            expect(result).toBe(false);
        });

        it('should return false when related Party contains one element and role matches but user does not', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName + 'a'
                }
            };

            const relatedParties = [
                {
                    role: role,
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName)
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(false);
        });

        it('should return true when related Party contains two element and one matches', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName
                }
            };

            const relatedParties = [
                {
                    role: role,
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName)
                },
                {
                    role: role + 'a',
                    id: userName + 'a',
                    href: getPartyHref('http', req.hostname, userName + 'a')
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(true);
        });

        it('should return false when related Party contains two element and none matches', function() {
            const tmfUtils = getTmfUtils();
            const role = 'seller';
            const userName = 'fiware';

            const req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    partyId: userName
                }
            };

            const relatedParties = [
                {
                    role: role + 'b',
                    id: userName + 'b',
                    href: getPartyHref('http', req.hostname, userName + 'b')
                },
                {
                    role: role + 'a',
                    id: userName + 'a',
                    href: getPartyHref('http', req.hostname, userName + 'a')
                }
            ];

            const result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(false);
        });
    });

    describe('Get Party Individuals Collection URL', function() {
        const testGetIndividualsCollectionURL = function(req, user) {
            const utils = jasmine.createSpyObj('utils', ['getAPIURL']);

            const tmfUtils = getTmfUtils(utils);
            tmfUtils.getIndividualURL(req);

            let expectedPath = '/' + config.endpoints.party.path + '/individual/';

            if (user) {
                expectedPath += user;
            }

            expect(utils.getAPIURL).toHaveBeenCalledWith(req.secure, req.hostname, config.port, expectedPath);
        };

        it('should call utils with http', function() {
            const req = {
                secure: false,
                hostname: 'belp.fiware.org'
            };

            testGetIndividualsCollectionURL(req);
        });

        it('should call utils with https', function() {
            config.proxy.secured = true;
            const req = {
                secure: true,
                hostname: 'belp.fiware.org'
            };

            testGetIndividualsCollectionURL(req);
        });

        it('should call utils with http and without proxy', function() {
            config.proxy.enabled = false;

            const req = {
                secure: false,
                hostname: 'anotherHost.com'
            };

            testGetIndividualsCollectionURL(req);
        });

        it('should call utils with https and without proxy', function() {
            config.proxy.enabled = false;

            const req = {
                secure: true,
                hostname: 'anotherHost.com'
            };

            testGetIndividualsCollectionURL(req);
        });
    });

    describe('Method haveSameStatus ', function() {

        it('should return true if all elements inside the array have the specified status', function(){
            const tmfUtils = getTmfUtils();
            const array=[]
            for(let i=0; i<5; i++){
                array.push({name: `n${i}`, lifecycleStatus: 'Launched'})
            }
            expect(array.length).toBe(5)
            result = tmfUtils.haveSameStatus('launched', array)
            expect(result).toBe(true)
        })

        it('should return true if all elements inside the array have the specified status', function(){
            const tmfUtils = getTmfUtils();
            const array=[]
            for(let i=0; i<5; i++){
                array.push({name: `n${i}`, lifecycleStatus: 'Launched'})
            }
            array.push({name: 'error', lifecycleStatus: 'Launche'})
            expect(array.length).toBe(6)
            result = tmfUtils.haveSameStatus('launched', array)
            expect(result).toBe(false)
        })

    })

    describe('Method refsToQuery', function(){
        it('should parse an array of refs to query structure string', function(){
            const tmfUtils = getTmfUtils();
            const array=[]
            for(let i=0; i<5; i++){
                array.push({id: `n${i}`, lifecycleStatus: 'Launched'})
            }
            expect(array.length).toBe(5)
            result = tmfUtils.refsToQuery(array)
            expect(result).toBe('n0,n1,n2,n3,n4')

        })
    })
});
