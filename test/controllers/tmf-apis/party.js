var proxyquire = require('proxyquire'),
    testUtils = require('../../utils');

describe('Party API', function() {

    var NOT_LOGGED_ERROR = {
        status: 401,
        message: 'You are not logged in'
    };

    var INVALID_PATH_ERROR = {
        status: 404,
        message: 'The given path is invalid'
    };

    var loggedIn;
    var config = testUtils.getDefaultConfig();
    var utils = {
        validateLoggedIn: function(req, callback) {

            if (loggedIn) {
                callback(null);
            } else {
                callback(NOT_LOGGED_ERROR);
            }
        }
    };

    var partyAPI = proxyquire('../../../controllers/tmf-apis/party', {
        './../../config': config,
        './../../lib/logger': testUtils.emptyLogger,
        './../../lib/utils': utils
    }).party;


    describe('Individuals', function() {

        var failIfNotLoggedIn = function(method, done) {

            loggedIn = false;

            var req = {
                method: method
            };

            partyAPI.checkPermissions(req, function(err) {
                expect(err).toBe(NOT_LOGGED_ERROR);
                done();
            });
        };

        describe('Retrieve', function() {

            it('should allow to list parties', function(done) {

                var req = {
                    method: 'GET'
                };

                partyAPI.checkPermissions(req, function(err) {
                    expect(err).toBe(null);
                    done();
                });
            });

        });

        describe('Creation', function() {

            it('should not allow to create individuals if not logged in', function(done) {
                failIfNotLoggedIn('POST', done);
            });

            var createTest = function(party, user, expectedErr, done) {

                loggedIn = true;

                var req = {
                    method: 'POST',
                    body: party,
                    user: user
                };

                partyAPI.checkPermissions(req, function(err) {

                    expect(err).toEqual(expectedErr);
                    done();
                });
            };


            it('should not allow to create individuals if body is invalid', function(done) {

                var expectedErr = {
                    status: 400,
                    message: 'The provided body is not a valid JSON'
                };

                createTest('{ INVALID JSON', null, expectedErr, done);
            });

            it('should not allow to create individuals when party id and user id mismatch', function(done) {

                var expectedErr = {
                    status: 403,
                    message: 'Provided party ID and request user ID mismatch'
                };

                createTest(JSON.stringify({ id: 'user' }), { id: 'another_user' }, expectedErr, done);
            });

            it('should allow to create individuals when party id an user id match', function(done) {
                var userId = 'user';
                createTest(JSON.stringify({ id: userId }), { id: userId }, null, done);
            });
        });

        describe('Modification', function() {

            var accessIndividualTest = function(individual, user, expectedErr, done) {

                loggedIn = true;

                var req = {
                    apiUrl: '/' + config.endpoints.party.path + '/api/partyManagement/v2/individual/' + individual,
                    method: 'PATCH',
                    user: user
                };

                partyAPI.checkPermissions(req, function(err) {
                    expect(err).toEqual(expectedErr);
                    done();
                });
            };

            it('should not allow to modify individual if not logged in', function(done) {
                failIfNotLoggedIn('PATCH', done);
            });

            it('should not allow to modify individual if path and request user id mismatch', function(done) {

                var expectedErr = {
                    status: 403,
                    message: 'You are not allowed to access this resource'
                };

                accessIndividualTest('user', { id: 'another_user' }, expectedErr, done);

            });

            it('should allow to modify individual if path and request user id match', function(done) {
                var user = 'user';
                accessIndividualTest(user, { id: user }, null, done);
            });

            it('should allow to modify individual if path and request user id match even if query string included', function(done) {
                var user = 'user';
                accessIndividualTest(user + '?fields=status', { id: user }, null, done);
            });

            it('should not allow to modify individual if user ID is not included in the path', function(done) {
                accessIndividualTest('', { id: 'test'}, INVALID_PATH_ERROR, done);
            });

            it('should not allow to modify individual if the path is not valid', function(done) {

                loggedIn = true;

                var user = 'test';

                var req = {
                    // Individual has been replaced by organization in this path
                    apiUrl: '/' + config.endpoints.party.path + '/api/partyManagement/v2/organization/' + user,
                    method: 'PATCH',
                    user: user
                };

                partyAPI.checkPermissions(req, function(err) {
                    expect(err).toEqual(INVALID_PATH_ERROR);
                    done();
                });
            });

        });

        it('should return 405 when the used method is not recognized', function(done) {

            loggedIn = true;

            var req = {
                method: 'OPTIONS'
            };

            partyAPI.checkPermissions(req, function(err) {

                expect(err).toEqual({
                    status: 405,
                    message: 'Method not allowed'
                });

                done();
            });
        });
   });
});