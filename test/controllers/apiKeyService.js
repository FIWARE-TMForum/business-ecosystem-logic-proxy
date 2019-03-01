/* Copyright (c) 2015 - 2018 CoNWeT Lab., Universidad Politécnica de Madrid
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

var proxyquire = require('proxyquire').noCallThru();

describe('Accounting Service', function() {
    var DEFAULT_URL = 'http://example/path';
    var DEFAULT_APIKEY = 'apiKey';

    var getAuthorizeServiceController = function (accServiceSchema, uuidMock) {
        return proxyquire('../../controllers/apiKeyService', {
            '../db/schemas/accountingService': accServiceSchema,
            'uuid/v4': uuidMock
        }).apiKeyService;
    };

    var invalidRequest = function(handler, body, statusExpected, bodyExpected, done) {
        var req = {
            body: body
        };

        var accSerivceController = getAuthorizeServiceController({}, {});

        var res = jasmine.createSpyObj('res', ['status', 'json']);

        res.status.and.returnValue(res);

        accSerivceController[handler](req, res);

        setTimeout(function() {
            expect(res.status).toHaveBeenCalledWith(statusExpected);
            expect(res.json).toHaveBeenCalledWith(bodyExpected);

            done();
        }, 100);
    };

    describe('Get api-key', function () {

        it('should return 400 when the body is empty', function (done) {
            invalidRequest('getApiKey', undefined, 400, {error: 'Invalid body'}, done);
        });

        it('should return 422 when the "url" is not defined', function (done) {
            invalidRequest('getApiKey', '{}', 422, {error: 'Url missing'}, done);
        });

        var saveAccountingService = function(saveReturn, sendMessage, statusExpected, done) {
            var uuidMock = function() {
                return DEFAULT_APIKEY;
            };

            var req = {
                body: '{ "url": "' + DEFAULT_URL + '"}'
            };

            var res = jasmine.createSpyObj('res', ['status', 'json']);
            res.status.and.returnValue(res);
            res.json.and.callFake(function() {
                expect(serviceInstance.url).toBe('http://example/path');
                expect(serviceInstance.state).toBe('UNCOMMITTED');

                expect(res.status).toHaveBeenCalledWith(statusExpected);

                expect(res.json).toHaveBeenCalledWith(sendMessage);

                done();
            });

            var serviceInstance = jasmine.createSpyObj('service', ['save']);
            serviceInstance.save.and.callFake(function(callback) {
                return callback(saveReturn);
            });
            var accServiceSchema = jasmine.createSpy();
            accServiceSchema.and.returnValue(serviceInstance);

            var accSerivceController = getAuthorizeServiceController(accServiceSchema, uuidMock);

            accSerivceController.getApiKey(req, res);
        };

        it('should return 500 when db fails', function(done) {
            saveAccountingService({ message: 'Error' }, { error: 'Error' }, 500, done);
        });

        it('should generate and save a new apiKey with "UNCOMMITTED" state', function(done) {
            saveAccountingService(null, { apiKey: DEFAULT_APIKEY }, 201, done);
        });
    });

    describe('Commit api-key', function() {
        var updateApikeyState = function(updateErr, updateRes, statusExpected, errExpected, done) {
            var req = {
                params: {
                    apiKey: DEFAULT_APIKEY
                }
            };

            var accServiceSchema = jasmine.createSpyObj('accServiceSchema', ['update']);
            accServiceSchema.update.and.callFake(function(conditions, update, callback) {
                return callback(updateErr, updateRes, {});
            });

            var accSerivceController = getAuthorizeServiceController(accServiceSchema, {});

            var res = jasmine.createSpyObj('res', ['status', 'send', 'json']);

            if (errExpected) {
                res.json.and.callFake(function() {
                    expect(accServiceSchema.update).toHaveBeenCalledWith(
                        { apiKey: DEFAULT_APIKEY },
                        { $set: { state: 'COMMITTED' } },
                        jasmine.any(Function)
                    );
                    expect(res.status).toHaveBeenCalledWith(statusExpected);
                    expect(res.json).toHaveBeenCalledWith(errExpected);
                    done();
                });
            } else {
                res.send.and.callFake(function() {
                    expect(accServiceSchema.update).toHaveBeenCalledWith(
                        { apiKey: DEFAULT_APIKEY },
                        { $set: { state: 'COMMITTED' } },
                        jasmine.any(Function)
                    );
                    expect(res.status).toHaveBeenCalledWith(statusExpected);
                    expect(res.send).toHaveBeenCalled();
                    done();
                });
            }

            res.status.and.callFake(function() {
                return res;
            });

            accSerivceController.commitApiKey(req, res);
        };

        it('should return 500 when db fails', function(done) {
            updateApikeyState({ message: 'Error' }, null, 500, { error: 'Error' }, done);
        });

        it('should return 404 when the API Key is invalid', function(done) {
            updateApikeyState(null, { n: 0 }, 404, { error: 'Invalid API Key' }, done);
        });

        it('should update to "COMMITTED" the state of apiKey received', function(done) {
            updateApikeyState(null, { nModified: 1 }, 200, null, done);
        });
    });
});
