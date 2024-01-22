/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2024 Future Internet Consulting and Development Solutions S.L.
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

const proxyquire = require('proxyquire').noCallThru();

describe('Accounting Service', function() {
    const DEFAULT_URL = 'http://example/path';
    const DEFAULT_APIKEY = 'apiKey';

    const getAuthorizeServiceController = function (accServiceSchema, uuidMock) {
        return proxyquire('../../controllers/apiKeyService', {
            '../db/schemas/accountingService': accServiceSchema,
            'uuid': uuidMock
        }).apiKeyService;
    };

    const invalidRequest = function(handler, body, statusExpected, bodyExpected, done) {
        const req = {
            body: body
        };

        const accSerivceController = getAuthorizeServiceController({}, {});

        const res = jasmine.createSpyObj('res', ['status', 'json']);
        res.status.and.returnValue(res);
        res.json.and.callFake(() => {
            expect(res.status).toHaveBeenCalledWith(statusExpected);
            expect(res.json).toHaveBeenCalledWith(bodyExpected);

            done();
        })

        accSerivceController[handler](req, res);
    };

    describe('Get api-key', function () {

        it('should return 400 when the body is empty', function (done) {
            invalidRequest('getApiKey', undefined, 400, {error: 'Invalid body'}, done);
        });

        it('should return 422 when the "url" is not defined', function (done) {
            invalidRequest('getApiKey', '{}', 422, {error: 'Url missing'}, done);
        });

        const saveAccountingService = function(saveReturn, sendMessage, statusExpected, done) {
            const uuidMock = {
                v4: function() {
                    return DEFAULT_APIKEY;
                }
            };

            const req = {
                body: '{ "url": "' + DEFAULT_URL + '"}'
            };

            const res = jasmine.createSpyObj('res', ['status', 'json']);
            res.status.and.returnValue(res);
            res.json.and.callFake(function() {
                expect(serviceInstance.url).toBe('http://example/path');
                expect(serviceInstance.state).toBe('UNCOMMITTED');

                expect(res.status).toHaveBeenCalledWith(statusExpected);

                expect(res.json).toHaveBeenCalledWith(sendMessage);

                done();
            });

            const serviceInstance = jasmine.createSpyObj('service', ['save']);
            serviceInstance.save.and.returnValue(saveReturn)

            const accServiceSchema = jasmine.createSpy();
            accServiceSchema.and.returnValue(serviceInstance);

            const accSerivceController = getAuthorizeServiceController(accServiceSchema, uuidMock);

            accSerivceController.getApiKey(req, res);
        };

        it('should return 500 when db fails', function(done) {
            saveAccountingService(Promise.reject({ message: 'Error' }), { error: 'Error' }, 500, done);
        });

        it('should generate and save a new apiKey with "UNCOMMITTED" state', function(done) {
            saveAccountingService(Promise.resolve(), { apiKey: DEFAULT_APIKEY }, 201, done);
        });
    });

    describe('Commit api-key', function() {
        const updateApikeyState = function(updateRes, statusExpected, errExpected, done) {
            const req = {
                params: {
                    apiKey: DEFAULT_APIKEY
                }
            };

            const accServiceSchema = jasmine.createSpyObj('accServiceSchema', ['update']);
            accServiceSchema.update.and.returnValue(updateRes)

            const accSerivceController = getAuthorizeServiceController(accServiceSchema, {});

            const res = jasmine.createSpyObj('res', ['status', 'send', 'json']);

            if (errExpected) {
                res.json.and.callFake(function() {
                    expect(accServiceSchema.update).toHaveBeenCalledWith(
                        { apiKey: DEFAULT_APIKEY },
                        { $set: { state: 'COMMITTED' } }
                    );
                    expect(res.status).toHaveBeenCalledWith(statusExpected);
                    expect(res.json).toHaveBeenCalledWith(errExpected);
                    done();
                });
            } else {
                res.send.and.callFake(function() {
                    expect(accServiceSchema.update).toHaveBeenCalledWith(
                        { apiKey: DEFAULT_APIKEY },
                        { $set: { state: 'COMMITTED' } }
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
            updateApikeyState(Promise.reject({ message: 'Error' }), 500, { error: 'Error' }, done);
        });

        it('should return 404 when the API Key is invalid', function(done) {
            updateApikeyState(Promise.resolve({ updatedCount: 0 }), 404, { error: 'Invalid API Key' }, done);
        });

        it('should update to "COMMITTED" the state of apiKey received', function(done) {
            updateApikeyState(Promise.resolve({ updatedCount: 1 }), 200, null, done);
        });
    });
});
