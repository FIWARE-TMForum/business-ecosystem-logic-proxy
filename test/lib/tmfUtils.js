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

var proxyquire =  require('proxyquire'),
    testUtils = require('../utils');

describe('TMF Utils', function() {

    var config = testUtils.getDefaultConfig();

    var getTmfUtils = function(utils) {
        return proxyquire('../../lib/tmfUtils', {
            './../config' : config,
            './utils': utils || {}
        });
    };

    var getPartyHref = function(protocol, hostname, userName) {
        return protocol + '://' + hostname + ':' + config.port + '/' + config.endpoints.party.path +
            '/api/partyManagement/v2/individual/' + userName;
    };

    describe('Is Owner', function() {

        var testIsOwner = function(req, info, expected) {
            var tmfUtils = getTmfUtils();

            var result = tmfUtils.isOwner(req, info);
            expect(result).toBe(expected);
        };

        it ('should return true when the user is owner of the given resource', function() {

            var userName = 'test';

            var req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    roles: [],
                    id: 'test'
                }
            };

            var info = {
                relatedParty: [{
                    role: 'Owner',
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName)
                }]
            };

            testIsOwner(req, info, true);
        });

        it ('should return false when the user is not owner of the resource', function() {

            var userName = 'user';

            var req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    roles: [],
                    id: 'another_user'
                }
            };

            var info = {
                relatedParty: [{
                    role: 'Owner',
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName)
                }]
            };

            testIsOwner(req, info, false);
        });

        it ('should return false when the href is invalid', function() {

            var userName = 'test';

            var req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    roles: [],
                    id: 'test'
                }
            };

            var info = {
                relatedParty: [{
                    role: 'Owner',
                    id: userName,
                    href: getPartyHref('http', req.hostname, userName + 'ABC')
                }]
            };

            testIsOwner(req, info, false);
        });

        it ('should return false when the resource does not contain related party field', function() {

            var req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    roles: [],
                    id: 'test'
                }
            };

            var info = {};
            testIsOwner(req, info, false);
        });

    });

    describe('Filter Related Party Fields', function() {

        var testFilterRelatedPartyFields = function(user, query, expectedErr, newQueryParams, done) {

            var buildQueryString = function(query) {

                var queryArray = [];

                for (var key in query) {
                    queryArray.push(key + '=' + query[key]);
                }

                return queryArray.join('&');
            };

            var originalApiUrl = '/example/api/path';
            var queryIncluded = query && Object.keys(query).length > 0;

            if (queryIncluded) {
                originalApiUrl += '?' + buildQueryString(query);
            }

            var tmfUtils = getTmfUtils();
            var req = {
                apiUrl: originalApiUrl,
                query : query,
                user: user
            };

            tmfUtils.filterRelatedPartyFields(req, function(err) {

                expect(err).toEqual(expectedErr);

                if (!err) {
                    var newQueryParamsExpected = newQueryParams && Object.keys(newQueryParams).length > 0;

                    var expectedApiUrl = originalApiUrl;

                    if (newQueryParamsExpected) {
                        var separator = queryIncluded ? '&' : '?';
                        expectedApiUrl = originalApiUrl + separator + buildQueryString(newQueryParams);
                    }

                    expect(req.apiUrl).toBe(expectedApiUrl);
                }

                done();
            });

        };

        it('should call callback with error when Related Party field includes href', function(done) {

            var user = {
                id: 'fiware'
            };

            var query = {
                'relatedParty.href': 'http://fiware.org/user/fiware'
            };

            var err = {
                status: 403,
                message: 'You are not allowed to filter items using these filters'
            };

            testFilterRelatedPartyFields(user, query, err, null, done);
        });

        it('should call callback with error when Related Party field includes role', function(done) {

            var user = {
                id: 'fiware'
            };

            var query = {
                'relatedParty.role': 'Customer'
            };

            var err = {
                status: 403,
                message: 'You are not allowed to filter items using these filters'
            };

            testFilterRelatedPartyFields(user, query, err, null, done);
        });

        it('should call callback with error when asking for items from another user', function(done) {

            var user = {
                id: 'fiware'
            };

            var query = {
                'relatedParty.id': user.id + 'a'
            };

            var err = {
                status: 403,
                message: 'You are not authorized to retrieve the orderings made by the user ' + query['relatedParty.id']
            };

            testFilterRelatedPartyFields(user, query, err, null, done);
        });

        it('should call callback without error when asking for their own items', function(done) {

            var user = {
                id: 'fiware'
            };

            var query = {
                'relatedParty.id': user.id
            };

            testFilterRelatedPartyFields(user, query, null, null, done);
        });

        it('should include party id when not included in the original request', function(done) {

            var user = {
                id: 'fiware'
            };

            var newQueryParams = {
                'relatedParty.id': user.id
            };

            testFilterRelatedPartyFields(user, {}, null, newQueryParams, done);
        });

        it('should include party id when not included in the original request and extra query params', function(done) {

            var user = {
                id: 'fiware'
            };

            var query = {
                state: 'failed'
            };

            var newQueryParams = {
                'relatedParty.id': user.id
            };

            testFilterRelatedPartyFields(user, query, null, newQueryParams, done);
        });

    });

    describe('Ensure Related Party Field', function() {

        var testEnsureRelatedParty = function(originalApiUrl, query, expectedApiUrl) {
            var req = {
                apiUrl: originalApiUrl,
                query: query
            };

            var tmfUtils = getTmfUtils();
            var callback = jasmine.createSpy();

            tmfUtils.ensureRelatedPartyIncluded(req, callback);

            expect(callback).toHaveBeenCalledWith(null);
            expect(req.apiUrl).toBe(expectedApiUrl);
        };

        var urlNotModified = function(originalApiUrl, query) {
            testEnsureRelatedParty(originalApiUrl, query, originalApiUrl);
        };

        var urlNotModifiedFields = function(fields) {
            urlNotModified('/product?fields=' + fields, { fields: fields });
        };

        it('should not modify the API URL when query is not included', function() {
            urlNotModified('/product', {});
        });

        it('should not modify the API URL when query included but fields is not included', function() {

            var name = 'fiware';
            urlNotModified('/product?name=' + name, { name: name });
        });

        it('should not modify the API URL when fields include related party at the beginning', function() {

            var fields = 'relatedParty,name';
            urlNotModifiedFields(fields);
        });

        it('should not modify the API URL when fields include related party at the end', function() {

            var fields = 'relatedParty,name';
            urlNotModifiedFields(fields);
        });

        it('should not modify the API URL when fields include related party in the middle', function() {

            var fields = 'name,relatedParty,version';
            urlNotModifiedFields(fields);
        });

        it('should modify the API URL when related party is not included in the fields query param ' +
                'and there are no more query params', function() {

            var fields = 'name';
            var originalApiUrl = '/product?fields=' + fields;
            var expectedApiUrl = originalApiUrl + ',relatedParty';

            testEnsureRelatedParty(originalApiUrl, { fields: fields }, expectedApiUrl);
        });


        it('should modify the API URL when related party is not included in the fields query param ' +
                'and there are more query params', function() {

            var version = '1';
            var fields = 'name';

            var urlPattern = '/product?fields=FIELDS&version=' + version;
            var originalApiUrl = urlPattern.replace('FIELDS', fields);
            var expectedApiUrl = urlPattern.replace('FIELDS', fields + ',relatedParty');

            testEnsureRelatedParty(originalApiUrl, { fields: fields, version: version }, expectedApiUrl);
        });

    });

    describe('Has Party Role', function() {

        it('should return false when related Party is empty', function() {
            var tmfUtils = getTmfUtils();
            var result = tmfUtils.hasPartyRole({ hostname: 'belp.fiware.org', secure: false, user: { id: 'fiware' } },
                [], 'seller');
            expect(result).toBe(false);
        });

        it('should return true when related Party contains one element and user and role matches', function() {

            var tmfUtils = getTmfUtils();
            var role = 'seller';
            var userName = 'fiware';

            var req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    id: userName
                }
            };

            var relatedParties = [{
                role: role,
                id: userName,
                href: getPartyHref('http', req.hostname, userName)
            }];

            var result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(true);

        });

        it('should return true when related Party contains one element and user and role (ignore case) matches', function() {

            var tmfUtils = getTmfUtils();
            var role = 'seller';
            var userName = 'fiware';

            var req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    id: userName
                }
            };

            var relatedParties = [{
                role: role.toUpperCase(),
                id: userName,
                href: getPartyHref('http', req.hostname, userName)
            }];

            var result = tmfUtils.hasPartyRole(req, relatedParties, role.toLowerCase());
            expect(result).toBe(true);

        });

        it('should return false when related Party contains one element and user matches but role does not', function() {

            var tmfUtils = getTmfUtils();
            var role = 'seller';
            var userName = 'fiware';

            var req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    id: userName
                }
            };

            var relatedParties = [ {
                role: role,
                id: userName,
                href: getPartyHref('http', req.hostname, userName)
            } ];

            var result = tmfUtils.hasPartyRole(req, relatedParties, role + 'a');
            expect(result).toBe(false);

        });

        it('should return false when related Party href does not match', function() {

            var tmfUtils = getTmfUtils();
            var role = 'seller';
            var userName = 'fiware';

            var req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    id: userName
                }
            };

            var relatedParties = [{
                role: role,
                id: userName,
                href: getPartyHref('http', req.hostname, userName + 'ABC')
            }];

            var result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(false);

        });


        it('should return false when related Party contains one element and role matches but user does not', function() {

            var tmfUtils = getTmfUtils();
            var role = 'seller';
            var userName = 'fiware';

            var req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    id: userName + 'a'
                }
            };

            var relatedParties = [{
                role: role,
                id: userName,
                href: getPartyHref('http', req.hostname, userName)
            }];

            var result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(false);

        });

        it('should return true when related Party contains two element and one matches', function() {
            var tmfUtils = getTmfUtils();
            var role = 'seller';
            var userName = 'fiware';

            var req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    id: userName
                }
            };

            var relatedParties = [ {
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

            var result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(true);

        });

        it('should return false when related Party contains two element and none matches', function() {
            var tmfUtils = getTmfUtils();
            var role = 'seller';
            var userName = 'fiware';

            var req = {
                secure: false,
                hostname: 'belp.fiware.org',
                user: {
                    id: userName
                }
            };

            var relatedParties = [ {
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

            var result = tmfUtils.hasPartyRole(req, relatedParties, role);
            expect(result).toBe(false);

        });
    });

    describe('Get Party Individuals Collection URL', function() {

        var testGetIndividualsCollectionURL = function(req, user) {

            var utils = jasmine.createSpyObj('utils', ['getAPIURL']);

            var tmfUtils = getTmfUtils(utils);
            tmfUtils.getIndividualURL(req);

            var expectedPath = '/' + config.endpoints.party.path + '/api/partyManagement/v2/individual/';

            if (user) {
                expectedPath += user;
            }

            expect(utils.getAPIURL).toHaveBeenCalledWith(req.secure, req.hostname, config.port, expectedPath);

        };

        it('should call utils with http', function() {

            var req = {
                secure: false,
                hostname: 'test'
            };

            testGetIndividualsCollectionURL(req)
        });

        it('should call utils with https', function() {

            var req = {
                secure: true,
                hostname: 'another_host.com'
            };

            testGetIndividualsCollectionURL(req)
        });


    });

});
