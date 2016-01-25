var proxyquire =  require('proxyquire'),
    testUtils = require('../utils');

describe('TMF Utils', function() {
    var config = testUtils.getDefaultConfig();

    var getTmfUtils = function() {
        return proxyquire('../../lib/tmfUtils', {
            './../config' : config
        });
    };

    var testCheckRoles = function (userInfo, expected) {
        var tmfUtils = getTmfUtils();

        result = tmfUtils.checkRole(userInfo, 'role');
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

    var testIsOwner = function(userInfo, info, expected) {
        var tmfUtils = getTmfUtils();

        result = tmfUtils.isOwner(userInfo, info);
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
