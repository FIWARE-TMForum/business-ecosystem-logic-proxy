var proxyquire =  require('proxyquire'),
    testUtils = require('../utils');

describe('TMF Utils', function() {
    var config = testUtils.getDefaultConfig();

    var getTmfUtils = function() {
        return proxyquire('../../lib/tmfUtils', {
            './../config' : config
        });
    };

    describe('Check Roles', function() {

        var testCheckRoles = function (userInfo, expected) {
            var tmfUtils = getTmfUtils();

            var result = tmfUtils.checkRole(userInfo, 'role');
            expect(result).toBe(expected);
        };

        it ('should return true when checking the given role', function() {
            var userInfo = {
                roles: [{
                    name: 'norole'
                }, {
                    name: 'role'
                }]
            };
            testCheckRoles(userInfo, true);
        });

        it ('should return false when checking the given role', function() {
            var userInfo = {
                roles: [{
                    name: 'norole'
                }]
            };
            testCheckRoles(userInfo, false);
        });

    });

    describe('Is Owner', function() {

        var testIsOwner = function(userInfo, info, expected) {
            var tmfUtils = getTmfUtils();

            var result = tmfUtils.isOwner(userInfo, info);
            expect(result).toBe(expected);
        };

        it ('should return true when the user is owner of the given resource', function() {
            var userInfo = {
                roles: [],
                id: 'test'
            };

            var info = {
                relatedParty: [{
                    role: 'Owner',
                    id: 'test'
                }]
            };

            testIsOwner(userInfo, info, true);
        });

        it ('should return true when the user is an admin', function() {
            var userInfo = {
                roles: [{
                    name: 'provider'
                }],
                id: 'test'
            };

            var info = {};
            testIsOwner(userInfo, info, true);
        });

        it ('should return false when the user is not owner of the resource', function() {
            var userInfo = {
                roles: [],
                id: 'test'
            };

            var info = {
                relatedParty: [{
                    role: 'Owner',
                    id: 'another'
                }]
            };

            testIsOwner(userInfo, info, false);
        });

        it ('should return false when the resource does not contain related party field', function() {
            var userInfo = {
                roles: [],
                id: 'test'
            };

            var info = {};
            testIsOwner(userInfo, info, false);
        });

    });

    describe('Validated Logged In', function() {

        it ('should call the callback with OK when the user is logged', function(done) {
            var tmfUtils = getTmfUtils();
            var req = {
                user: 'test'
            };

            tmfUtils.validateLoggedIn(req, function(err) {
                expect(err).toBe(undefined);
                done();
            });
        });

        it ('should call the callback with error 401 if the user is not logged', function(done) {
            var tmfUtils = getTmfUtils();
            var req = {};

            tmfUtils.validateLoggedIn(req, function(err) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(401);
                expect(err.message).toBe('You need to be authenticated to perform this request');
                done();
            });
        });

    });

    describe('Filter Related Party Fields', function() {

        var testFilterRelatedPartyFileds = function(user, query, expectedErr, newQueryParams, done) {

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

            testFilterRelatedPartyFileds(user, query, err, null, done);
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

            testFilterRelatedPartyFileds(user, query, err, null, done);
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

            testFilterRelatedPartyFileds(user, query, err, null, done);
        });

        it('should call callback without error when asking for their own items', function(done) {

            var user = {
                id: 'fiware'
            };

            var query = {
                'relatedParty.id': user.id
            };

            testFilterRelatedPartyFileds(user, query, null, null, done);
        });

        it('should include party id when not included in the original request', function(done) {

            var user = {
                id: 'fiware'
            };

            var newQueryParams = {
                'relatedParty.id': user.id
            };

            testFilterRelatedPartyFileds(user, {}, null, newQueryParams, done);
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

            testFilterRelatedPartyFileds(user, query, null, newQueryParams, done);
        });

    });

    describe('Has Role', function() {

        it('should return false when related Party is empty', function() {
            var tmfUtils = getTmfUtils();
            var result = tmfUtils.hasRole([], 'seller', { id: 'fiware' });
            expect(result).toBe(false);
        });

        it('should return true when related Party contains one element and user and role matches', function() {
            var tmfUtils = getTmfUtils();
            var role = 'seller';
            var userName = 'fiware';

            var relatedParties = [ { role: role, id: userName } ];
            var user = { id: userName };

            var result = tmfUtils.hasRole(relatedParties, role, user);
            expect(result).toBe(true);

        });

        it('should return true when related Party contains one element and user and role (ignore case) matches', function() {

            var tmfUtils = getTmfUtils();
            var role = 'seller';
            var userName = 'fiware';

            var relatedParties = [ { role: role.toUpperCase(), id: userName } ];
            var user = { id: userName };

            var result = tmfUtils.hasRole(relatedParties, role.toLowerCase(), user);
            expect(result).toBe(true);

        });

        it('should return false when related Party contains one element and user matches but role does not', function() {

            var tmfUtils = getTmfUtils();
            var role = 'seller';
            var userName = 'fiware';

            var relatedParties = [ { role: role, id: userName } ];
            var user = { id: userName };

            var result = tmfUtils.hasRole(relatedParties, role + 'a', user);
            expect(result).toBe(false);

        });


        it('should return false when related Party contains one element and role matches but user does not', function() {

            var tmfUtils = getTmfUtils();
            var role = 'seller';
            var userName = 'fiware';

            var relatedParties = [ { role: role, id: userName } ];
            var user = { id: userName + 'a' };

            var result = tmfUtils.hasRole(relatedParties, role, user);
            expect(result).toBe(false);

        });

        it('should return true when related Party contains two element and one matches', function() {
            var tmfUtils = getTmfUtils();
            var role = 'seller';
            var userName = 'fiware';

            var relatedParties = [ { role: role, id: userName }, { role: role + 'a', id: userName + 'a' } ];
            var user = { id: userName };

            var result = tmfUtils.hasRole(relatedParties, role, user);
            expect(result).toBe(true);

        });

        it('should return false when related Party contains two element and none matches', function() {
            var tmfUtils = getTmfUtils();
            var role = 'seller';
            var userName = 'fiware';

            var relatedParties = [ { role: role + 'b', id: userName + 'b' }, { role: role + 'a', id: userName + 'a' } ];
            var user = { id: userName };

            var result = tmfUtils.hasRole(relatedParties, role, user);
            expect(result).toBe(false);

        });
    });

    describe('Update Body', function() {

        it('should update the body with a stringified version of the object given', function() {

            var tmfUtils = getTmfUtils();

            var newBody = { example: '1', id: 7, user: { name: 'fiware' } };

            var req = {
                body: null,
                headers: {}
            };

            tmfUtils.updateBody(req, newBody);

            var stringifiedBody = JSON.stringify(newBody);
            var expectedLength = stringifiedBody.length;

            expect(req.body).toBe(stringifiedBody);
            expect(req.headers['content-length']).toBe(expectedLength);

        });

    });

    describe('Method Not Allowed', function() {
        it('should call the callback with a 405 error message', function(done) {
            var tmfutils = getTmfUtils();
            var req = {
                method: 'DELETE'
            };

            tmfutils.methodNotAllowed(req, function(err) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(405);
                expect(err.message).toBe('The HTTP method DELETE is not allowed in the accessed API');
                done();
            })
        });
    });

});
