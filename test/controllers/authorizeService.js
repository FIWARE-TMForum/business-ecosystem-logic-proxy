var proxyquire = require('proxyquire').noCallThru();

describe('Accounting Service', function () {

	var DEFAULT_URL = 'http://example/path';
	var DEFAULT_APIKEY = 'apiKey';

	var getAuthorizeServiceController = function (accServiceSchema, config) {
		return proxyquire('../../controllers/authorizeService', {
			'../db/schemas/accountingService': accServiceSchema,
			'../config': config
		}).authorizeService;
	};

	describe('Get api-key', function () {

		it('should return 401 when the requester is not the WStore', function (done) {
			var WStoreHost = 'localhost';
			var WStorePort = '8080';

			var config = {
				appHost: WStoreHost,
				endpoints: {
					charging: {
						port: WStorePort
					}
				}
			};

			var accSerivceController = getAuthorizeServiceController({}, config);

			var req = {
				ip: {
					replace: function (expr) { return '130.25.13.12'}
				},
				connection: {
					remotePort: 9065
				}
			};
			var res = {
				status: function (code) {
					return this;
				},
				json: function (err) {}
			};
			spyOn(res, 'status').and.callThrough();
			spyOn(res, 'json').and.callThrough();

			accSerivceController.getApiKey(req, res);

			setTimeout(function () {

				expect(res.status).toHaveBeenCalledWith(401);
				expect(res.json).toHaveBeenCalledWith({ error: 'Invalid remote client' });

				done();

			}, 100);
		});

		it('should return 400 when the "url" is not defined', function (done) {
			var WStoreHost = 'localhost';
			var WStorePort = '8080';

			var config = {
				appHost: WStoreHost,
				endpoints: {
					charging: {
						port: WStorePort
					}
				}
			};

			var accSerivceController = getAuthorizeServiceController({}, config);

			var req = {
				ip: {
					replace: function (expr) { return WStoreHost}
				},
				connection: {
					remotePort: WStorePort
				},
				body: '{}'
			};
			var res = {
				status: function (code) {
					return this;
				},
				json: function (err) {}
			};
			spyOn(res, 'status').and.callThrough();
			spyOn(res, 'json').and.callThrough();

			accSerivceController.getApiKey(req, res);

			setTimeout(function () {

				expect(res.status).toHaveBeenCalledWith(400);
				expect(res.json).toHaveBeenCalledWith({error: 'Url missing'});

				done();

			}, 100);
		});

		it('should return 500 when db fails', function (done) {
			var WStoreHost = 'localhost';
			var WStorePort = '8080';
			var serviceSaved = null;

			var config = {
				appHost: WStoreHost,
				endpoints: {
					charging: {
						port: WStorePort
					}
				}
			};
			var accServiceSchema = function () {
				return {
					save: function (callback) {
						serviceSaved = this;
						return callback('Error');
					}
				}
			};

			var accSerivceController = getAuthorizeServiceController(accServiceSchema, config);

			var req = {
				ip: {
					replace: function (expr) { return WStoreHost}
				},
				connection: {
					remotePort: WStorePort
				},
				body: '{ "url": "' + DEFAULT_URL + '"}'
			};
			var res = {
				status: function (code) {
					return this;
				},
				send: function () {}
			};
			spyOn(res, 'status').and.callThrough();
			spyOn(res, 'send').and.callThrough();

			accSerivceController.getApiKey(req, res);

			setTimeout(function () {
				expect(serviceSaved.url).toBe(DEFAULT_URL);
				expect(serviceSaved.state).toBe("UNCOMMITTED");

				expect(res.status).toHaveBeenCalledWith(500);
				expect(res.send).toHaveBeenCalled();

				done();
			}, 100);
		});

		it('Should generate and save a new apiKey with "UNCOMMITTED" state', function (done) {
			var WStoreHost = 'localhost';
			var WStorePort = '8080';
			var serviceSaved = null;

			var config = {
				appHost: WStoreHost,
				endpoints: {
					charging: {
						port: WStorePort
					}
				}
			};
			var accServiceSchema = function () {
				return {
					save: function (callback) {
						serviceSaved = this;
						return callback(null);
					}
				}
			};

			var accSerivceController = getAuthorizeServiceController(accServiceSchema, config);

			var req = {
				ip: {
					replace: function (expr) { return WStoreHost}
				},
				connection: {
					remotePort: WStorePort
				},
				body: '{ "url": "' + DEFAULT_URL + '"}'
			};
			var res = {
				status: function (code) {
					return this;
				},
				json: function (msg) {}
			};
			spyOn(res, 'status').and.callThrough();
			spyOn(res, 'json').and.callThrough();

			accSerivceController.getApiKey(req, res);

			setTimeout(function () {
				expect(serviceSaved.url).toBe(DEFAULT_URL);
				expect(serviceSaved.state).toBe("UNCOMMITTED");

				expect(res.status).toHaveBeenCalledWith(202);
				expect(res.status).toHaveBeenCalled();
				expect(res.json).toHaveBeenCalled();

				done();
			}, 100);
		});
	});

	describe('Commit api-key', function () {

		it('should return 401 when the requester is not the WStore', function (done) {
			var WStoreHost = 'localhost';
			var WStorePort = '8080';

			var config = {
				appHost: WStoreHost,
				endpoints: {
					charging: {
						port: WStorePort
					}
				}
			};

			var accSerivceController = getAuthorizeServiceController({}, config);

			var req = {
				ip: {
					replace: function (expr) { return '130.25.13.12'}
				},
				connection: {
					remotePort: 9065
				}
			};
			var res = {
				status: function (code) {
					return this;
				},
				json: function (err) {}
			};
			spyOn(res, 'status').and.callThrough();
			spyOn(res, 'json').and.callThrough();

			accSerivceController.commitApiKey(req, res);

			setTimeout(function () {

				expect(res.status).toHaveBeenCalledWith(401);
				expect(res.json).toHaveBeenCalledWith({ error: 'Invalid remote client' });

				done();

			}, 100);
		});

		it('should return 400 when the "apiKey" is not defined', function (done) {
			var WStoreHost = 'localhost';
			var WStorePort = '8080';

			var config = {
				appHost: WStoreHost,
				endpoints: {
					charging: {
						port: WStorePort
					}
				}
			};

			var accSerivceController = getAuthorizeServiceController({}, config);

			var req = {
				ip: {
					replace: function (expr) { return WStoreHost}
				},
				connection: {
					remotePort: WStorePort
				},
				body: '{}'
			};
			var res = {
				status: function (code) {
					return this;
				},
				json: function (err) {}
			};
			spyOn(res, 'status').and.callThrough();
			spyOn(res, 'json').and.callThrough();

			accSerivceController.commitApiKey(req, res);

			setTimeout(function () {

				expect(res.status).toHaveBeenCalledWith(400);
				expect(res.json).toHaveBeenCalledWith({error: 'ApiKey missing'});

				done();

			}, 100);

		});

		it('should return 500 when db fails', function (done) {
			var WStoreHost = 'localhost';
			var WStorePort = '8080';
			var selectQuery = null;
			var updateQuery = null;

			var config = {
				appHost: WStoreHost,
				endpoints: {
					charging: {
						port: WStorePort
					}
				}
			};
			var accServiceSchema = function () {
				return {
					update: function (select, update, callback) {
						selectQuery = select;
						updateQuery = update;
						return callback('Error');
					}
				}
			};

			var accSerivceController = getAuthorizeServiceController(accServiceSchema, config);

			var req = {
				ip: {
					replace: function (expr) { return WStoreHost}
				},
				connection: {
					remotePort: WStorePort
				},
				body: '{ "apiKey": "' + DEFAULT_APIKEY + '"}'
			};
			var res = {
				status: function (code) {
					return this;
				},
				send: function () {}
			};
			spyOn(res, 'status').and.callThrough();
			spyOn(res, 'send').and.callThrough();

			accSerivceController.commitApiKey(req, res);

			setTimeout(function () {
				expect(selectQuery.apiKey).toBe(DEFAULT_APIKEY);
				expect(updateQuery['$set'].state).toBe('COMMITTED');

				expect(res.status).toHaveBeenCalledWith(500);
				expect(res.send).toHaveBeenCalled();

				done();
			}, 100);
		});

		it('Should update to "COMMITTED" the state of apiKey received', function (done) {
			var WStoreHost = 'localhost';
			var WStorePort = '8080';
			var selectQuery = null;
			var updateQuery = null;

			var config = {
				appHost: WStoreHost,
				endpoints: {
					charging: {
						port: WStorePort
					}
				}
			};
			var accServiceSchema = function () {
				return {
					update: function (select, update, callback) {
						selectQuery = select;
						updateQuery = update;
						return callback(null);
					}
				}
			};

			var accSerivceController = getAuthorizeServiceController(accServiceSchema, config);

			var req = {
				ip: {
					replace: function (expr) { return WStoreHost}
				},
				connection: {
					remotePort: WStorePort
				},
				body: '{ "apiKey": "' + DEFAULT_APIKEY + '"}'
			};
			var res = {
				status: function (code) {
					return this;
				},
				send: function () {}
			};
			spyOn(res, 'status').and.callThrough();
			spyOn(res, 'send').and.callThrough();

			accSerivceController.commitApiKey(req, res);

			setTimeout(function () {
				expect(selectQuery.apiKey).toBe(DEFAULT_APIKEY);
				expect(updateQuery['$set'].state).toBe('COMMITTED');

				expect(res.status).toHaveBeenCalledWith(201);
				expect(res.send).toHaveBeenCalled();

				done();
			}, 100);
		});
	});
});