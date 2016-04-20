var proxyquire = require('proxyquire').noCallThru();

describe('Accounting Service', function () {

	var DEFAULT_URL = 'http://example/path';
    var DEFAULT_WSTOREHOST = 'localhost';
	var DEFAULT_APIKEY = 'apiKey';

	var getAuthorizeServiceController = function (accServiceSchema, config) {
		return proxyquire('../../controllers/authorizeService', {
			'../db/schemas/accountingService': accServiceSchema,
			'../config': config
		}).authorizeService;
	};

    var invalidRequest = function (handler, req, statusExpected, bodyExpected, done) {
        var config = {
            appHost: DEFAULT_WSTOREHOST
        };

        var accSerivceController = getAuthorizeServiceController({}, config);

        res = jasmine.createSpyObj('res', ['status', 'json']);

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
			var req = {
				ip: {
					replace: function (expr) { return '130.25.13.12'}
				}
			};

            invalidRequest('getApiKey', req, 401, {error: 'Invalid remote client'}, done);
		});

		it('should return 400 when the "url" is not defined', function (done) {
			var req = {
				ip: {
					replace: function (expr) { return DEFAULT_WSTOREHOST}
				},
				body: '{}'
			};

            invalidRequest('getApiKey', req, 400, {error: 'Url missing'}, done);
		});

        var saveAccountingService = function (saveReturn, sendFunction, statusExpected, done) {
            var config = {
                appHost: DEFAULT_WSTOREHOST,
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

            var accSerivceController = getAuthorizeServiceController(accServiceSchema, config);

            accSerivceController.getApiKey(req, res);

            setTimeout(function () {
                expect(serviceInstance.url).toBe('http://example/path');
                expect(serviceInstance.state).toBe('UNCOMMITTED');

                expect(res.status).toHaveBeenCalledWith(statusExpected);
                expect(res[sendFunction]).toHaveBeenCalled();

                done();
            }, 100);
        };

		it('should return 500 when db fails', function (done) {
            saveAccountingService('Error', 'send', 500, done);
		});

		it('Should generate and save a new apiKey with "UNCOMMITTED" state', function (done) {
			saveAccountingService(null, 'json', 202, done);
		});
	});

	describe('Commit api-key', function () {

		it('should return 401 when the requester is not the WStore', function (done) {
			var req = {
				ip: {
					replace: function (expr) { return '130.25.13.12'}
				}
			};

            invalidRequest('commitApiKey', req, 401, {error: 'Invalid remote client'}, done);
		});

        var updateApikeyState = function(updateReturn, statusExpected, done) {
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
                return callback(updateReturn, {});
            });

            var accSerivceController = getAuthorizeServiceController(accServiceSchema, config);

            var res = jasmine.createSpyObj('res', ['status', 'send']);
            res.status.and.callFake(function () {
                return res;
            });

            accSerivceController.commitApiKey(req, res);

            setTimeout(function () {
                expect(accServiceSchema.update.calls.argsFor(0)[0]).toEqual({ apiKey: DEFAULT_APIKEY });
                expect(accServiceSchema.update.calls.argsFor(0)[1]).toEqual({ $set: {state: 'COMMITTED'}});

                expect(res.status).toHaveBeenCalledWith(statusExpected);
                expect(res.send).toHaveBeenCalled();

                done();
            }, 100);
        };

		it('should return 500 when db fails', function (done) {
			updateApikeyState('Error', 500, done);
		});

		it('Should update to "COMMITTED" the state of apiKey received', function (done) {
			updateApikeyState(null, 201, done);
		});
	});
});