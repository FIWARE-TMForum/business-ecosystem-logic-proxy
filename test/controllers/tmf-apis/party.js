var proxyquire = require('proxyquire'),
    testUtils = require('../../utils');

describe('Party API', function() {

    var NOT_LOGGED_ERROR = {
        status: 401,
        message: 'You are not logged in'
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

        var individualsBaseUrl = '/' + config.endpoints.party.path + '/api/partyManagement/v2/individual';

        var failIfNotLoggedIn = function(method, url, done) {

            loggedIn = false;

            var req = {
                apiUrl: url,
                method: method
            };

            partyAPI.checkPermissions(req, function(err) {
                expect(err).toBe(NOT_LOGGED_ERROR);
                done();
            });
        };

        describe('List', function() {

            var listIndividualsNotAllowedLoggedIn = function(includeLastSlash, done) {

                loggedIn = true;

                var path = individualsBaseUrl + (includeLastSlash ? '/' : '');

                var req = {
                    apiUrl: path,
                    method: 'GET'
                };

                partyAPI.checkPermissions(req, function(err) {

                    expect(err).toEqual({
                        status: 403,
                        message: 'Parties cannot be listed'
                    });

                    done();
                });
            };

            it('should not allow to retrieve the list of individuals if not logged in', function(done) {
                failIfNotLoggedIn('GET', individualsBaseUrl, done);
            });

            it('should not allow to retrieve the list of individuals even if logged in - With final slash', function(done) {
                listIndividualsNotAllowedLoggedIn(true, done);
            });

            it('should not allow to retrieve the list of individuals even if logged in - Without final slash', function(done) {
                listIndividualsNotAllowedLoggedIn(false, done);
            });

        });

        describe('Creation', function() {

            it('should not allow to create individuals if not logged in', function(done) {
                failIfNotLoggedIn('POST', individualsBaseUrl, done);
            });

            var createTest = function(party, user, expectedErr, done) {

                loggedIn = true;

                var req = {
                    apiUrl: individualsBaseUrl,
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

        describe('Retrieval && Modification', function() {

            var accessIndividualTest = function(individual, user, expectedErr, done) {

                loggedIn = true;

                var req = {
                    apiUrl: individualsBaseUrl + '/' + individual,
                    method: 'GET',
                    user: user
                };

                partyAPI.checkPermissions(req, function(err) {

                    expect(err).toEqual(expectedErr);
                    done();
                });
            };

            it('should not allow to retrieve/modify individual if not logged in', function(done) {
                failIfNotLoggedIn('GET', individualsBaseUrl + '/user', done);
            });

            it('should not allow to retrieve/modify individual if path and request user id mismatch', function(done) {

                var expectedErr = {
                    status: 403,
                    message: 'You are not allowed to access this resource'
                };

                accessIndividualTest('user', { id: 'another_user' }, expectedErr, done);

            });

            it('should allow to retrieve/modify individual if path and request user id match', function(done) {
                var user = 'user';
                accessIndividualTest(user, { id: user }, null, done);
            });

            it('should allow to retrieve/modify individual if path and request user id match even if query string included', function(done) {
                var user = 'user';
                accessIndividualTest(user + '?fields=status', { id: user }, null, done);
            });

        });

        it('should return 404 when accessing an API different from Individuals', function(done) {

            loggedIn = true;

            var req = {
                apiUrl: 'another_api/another_path/another_collection/another_resource?a=b',
                method: 'GET'
            };

            partyAPI.checkPermissions(req, function(err) {

                expect(err).toEqual({
                    status: 404,
                    message: 'API not implemented'
                });

                done();
            });
        });
   });
});