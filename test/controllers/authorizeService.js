var proxyquire = require('proxyquire').noCallThru();

describe('Accounting Service', function () {

    var DEFAULT_URL = 'http://example/path';
    var DEFAULT_WSTOREHOST = 'localhost';
    var DEFAULT_APIKEY = 'apiKey';

    var getAuthorizeServiceController = function (accServiceSchema, config, uuidMock) {
        return proxyquire('../../controllers/authorizeService', {
            '../db/schemas/accountingService': accServiceSchema,
            '../config': config,
            'node-uuid': uuidMock
        }).authorizeService;
    };

    var invalidRequest = function (handler, ip, body, statusExpected, bodyExpected, done) {
        var config = {
            appHost: DEFAULT_WSTOREHOST
        };

        var req = {
            ip: {
                replace: function (expr) { return ip}
            },
            body: body
        };

        var accSerivceController = getAuthorizeServiceController({}, config, {});

        var res = jasmine.createSpyObj('res', ['status', 'json']);

        res.status.and.returnValue(res);

        accSerivceController[handler](req, res);

        setTimeout(function () {

            expect(res.status).toHaveBeenCalledWith(statusExpected);
            expect(res.json).toHaveBeenCalledWith(bodyExpected);

            done();

        }, 100);
    };

    describe('Get api-key', function () {

        it('should return 401 when the requester is not the WStore', function (done) {

            invalidRequest('getApiKey', '130.25.13.12', undefined, 401, {error: 'Invalid remote client'}, done);
        });

        it('should return 400 when the body is empty', function (done) {

            invalidRequest('getApiKey', DEFAULT_WSTOREHOST, undefined, 400, {error: 'Invalid body'}, done);
        });

        it('should return 400 when the "url" is not defined', function (done) {

            invalidRequest('getApiKey', DEFAULT_WSTOREHOST, '{}', 400, {error: 'Url missing'}, done);
        });

        var saveAccountingService = function (saveReturn, sendFunction, sendMessage, statusExpected, done) {
            var config = {
                appHost: DEFAULT_WSTOREHOST,
            };

            var uuidMock = {
                v4: function () {
                    return DEFAULT_APIKEY;
                }
            };

            var req = {
                ip: {
                    replace: function (expr) { return DEFAULT_WSTOREHOST}
                },
                body: '{ "url": "' + DEFAULT_URL + '"}'
            };

            var res = jasmine.createSpyObj('res', ['status', sendFunction]);
            res.status.and.returnValue(res);

            var serviceInstance = jasmine.createSpyObj('service', ['save']);
            serviceInstance.save.and.callFake( function (callback) {
                return callback(saveReturn);
            });
            var accServiceSchema = jasmine.createSpy();
            accServiceSchema.and.returnValue(serviceInstance);

            var accSerivceController = getAuthorizeServiceController(accServiceSchema, config, uuidMock);

            accSerivceController.getApiKey(req, res);

            setTimeout(function () {
                expect(serviceInstance.url).toBe('http://example/path');
                expect(serviceInstance.state).toBe('UNCOMMITTED');

                expect(res.status).toHaveBeenCalledWith(statusExpected);

                if (sendFunction === 'send') {
                    expect(res[sendFunction]).toHaveBeenCalled();
                }

                if (sendFunction === 'json') {
                    expect(res[sendFunction]).toHaveBeenCalledWith(sendMessage);
                }

                done();
            }, 100);
        };

        it('should return 500 when db fails', function (done) {
            saveAccountingService('Error', 'send', null, 500, done);
        });

        it('Should generate and save a new apiKey with "UNCOMMITTED" state', function (done) {
            saveAccountingService(null, 'json', {apiKey: DEFAULT_APIKEY}, 201, done);
        });
    });

    describe('Commit api-key', function () {

        it('should return 401 when the requester is not the WStore', function (done) {

            invalidRequest('commitApiKey', '130.25.13.12', undefined, 401, {error: 'Invalid remote client'}, done);
        });

        var updateApikeyState = function(updateErr, updateRes, statusExpected, errExpected, done) {
            var config = {
                appHost: DEFAULT_WSTOREHOST,
            };
            var req = {
                ip: {
                    replace: function (expr) { return DEFAULT_WSTOREHOST}
                },
                params: {
                    apiKey: DEFAULT_APIKEY
                }
            };

            var  accServiceSchema = jasmine.createSpyObj('accServiceSchema', ['update']);
            accServiceSchema.update.and.callFake( function (conditions, update, callback) {
                return callback(updateErr, updateRes, {});
            });

            var accSerivceController = getAuthorizeServiceController(accServiceSchema, config, {});

            var res = jasmine.createSpyObj('res', ['status', 'send', 'json']);
            res.status.and.callFake(function () {
                return res;
            });

            accSerivceController.commitApiKey(req, res);

            setTimeout(function () {
                expect(accServiceSchema.update).toHaveBeenCalledWith({ apiKey: DEFAULT_APIKEY }, { $set: {state: 'COMMITTED'}}, jasmine.any(Function));

                expect(res.status).toHaveBeenCalledWith(statusExpected);

                if (errExpected) {
                    expect(res.json).toHaveBeenCalledWith(errExpected);
                } else {
                    expect(res.send).toHaveBeenCalled();
                }

                done();
            }, 100);
        };

        it('should return 500 when db fails', function (done) {
            updateApikeyState('Error', {}, 500, null, done);
        });

        it('should return 404 when the API Key is invalid', function (done) {
           updateApikeyState(null, {nModified: 0}, 404, {error: 'Invalid API Key'}, done); 
        });

        it('Should update to "COMMITTED" the state of apiKey received', function (done) {
           updateApikeyState(null, {nModified: 1}, 200, null, done);
        });
    });
});