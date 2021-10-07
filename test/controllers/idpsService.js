/* Copyright (c) 2021 Future Internet Consulting and Development Solutions S.L.
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

const { json } = require('body-parser');
const proxyquire = require('proxyquire');

describe('IDPs API', () => {

    const getIDPController = function(IDPSchema, config) {
        return proxyquire('../../controllers/idpsService', {
            '../db/schemas/idpModel': IDPSchema,
            '../config': config
        }).idpService;
    };

    describe('Get IDP', () => {
        const defaultIDP = 'IDP';
        const req = {
            params: {
                idpId: defaultIDP
            }
        };

        it('should return the requested IDP if found', (done) => {
            let querysend = null;

            const result = {
                name: 'Test IDP',
                server: 'http://testidp.com',
                idpId: 'IDP',
                description: 'Test desciption'
            };

            const schema = {
                findOne: (query, callback) => {
                    querysend = query;
                    callback(null, result);
                }
            };

            const idpController = getIDPController(schema, {});
            const res = jasmine.createSpyObj('res', ['json', 'end']);

            res.end = () => {
                // Last method called in the test
                expect(querysend).toEqual({idpId: defaultIDP})
                expect(res.statusCode).toEqual(200);
                expect(res.json).toHaveBeenCalledWith(result);
                done();
            }
            idpController.getIdp(req, res);
        });

        const testError = (schema, code, msg, done) => {
            const idpController = getIDPController(schema, {});
            const res = {
                status: function status (statusCode) {
                    return {
                        json: (result) => {
                            expect(schema.query()).toEqual({idpId: defaultIDP});
                            expect(statusCode).toEqual(code);
                            expect(result).toEqual({ error: msg });
                            done();
                        }
                    }
                }
            }

            idpController.getIdp(req, res);
        };

        it('should return a 500 error if find operation fails', (done) => {
            let querysend = null;
            const schema = {
                findOne: (query, callback) => {
                    querysend = query;
                    throw new Error('Unexpected error');
                },
                query: () => {
                    return querysend
                }
            };
            testError(schema, 500, 'Unexpected error' + ' Invalid request', done);
        });

        it('should return a 500 error if find operation returns an error', (done) => {
            let querysend = null;
            const schema = {
                findOne: (query, callback) => {
                    querysend = query;
                    callback('error', null);
                },
                query: () => {
                    return querysend
                }
            };
            testError(schema, 500, 'Unexpected error', done);
        });

        it('should return a 404 error if the IDP is not found', (done) => {
            let querysend = null;
            const schema = {
                findOne: (query, callback) => {
                    querysend = query;
                    callback(null, null);
                },
                query: () => {
                    return querysend
                }
            };
            testError(schema, 404, 'Idp not found', done);
        });
    });

    describe('Get IDPs', () => {

        const testSearch = (req, query, done) => {
            let querysend = null;

            const result = [{
                name: 'Test IDP',
                server: 'http://testidp.com',
                idpId: 'IDP',
                description: 'Test desciption'
            }, {
                name: 'Test IDP 2',
                server: 'http://testidp2.com',
                idpId: 'IDP2',
                description: 'Test desciption'
            }];

            const schema = {
                find: (query, callback) => {
                    querysend = query;
                    callback(null, result);
                }
            };

            const idpController = getIDPController(schema, {});
            const res = jasmine.createSpyObj('res', ['json', 'end']);

            res.end = () => {
                // Last method called in the test
                expect(querysend).toEqual(query)
                expect(res.statusCode).toEqual(200);
                expect(res.json).toHaveBeenCalledWith(result);
                done();
            }
            idpController.getIdps(req, res);
        }

        it('should return all IDPs', (done) => {
            testSearch({
                query: {}
            }, {}, done)
        });

        it('should return IDPs that match the search params', (done) => {
            testSearch({
                query: {
                    search: 'test'
                }
            }, { $text: { $search: 'test' } }, done)
        });

        const testError = (schema, code, msg, done) => {
            const idpController = getIDPController(schema, {});
            const res = {
                status: function status (statusCode) {
                    return {
                        json: (result) => {
                            expect(schema.query()).toEqual({});
                            expect(statusCode).toEqual(code);
                            expect(result).toEqual({ error: msg });
                            done();
                        }
                    }
                }
            }

            const req = {
                query: {}
            };
            idpController.getIdps(req, res);
        };

        it('should return a 500 error if find operation fails', (done) => {
            let querysend = null;
            const schema = {
                find: (query, callback) => {
                    querysend = query;
                    throw new Error('Unexpected error');
                },
                query: () => {
                    return querysend
                }
            };
            testError(schema, 500, 'Unexpected error' + ' Invalid request', done);
        });

        it('should return a 500 error if find operation returns an error', (done) => {
            let querysend = null;
            const schema = {
                find: (query, callback) => {
                    querysend = query;
                    callback('error', null);
                },
                query: () => {
                    return querysend
                }
            };
            testError(schema, 500, 'Unexpected error', done);
        })
    });

    describe('Get IDPs', () => {
    });

    describe('Get IDPs DBS', () => {
    });

    describe('Create IDP', () => {
        it('should register a new IDP', (done) => {
            const body = {
                name: 'Test IDP',
                idpId: 'IDP',
                server: 'http://ipdserver.com',
                description: 'Test description'
            };

            const req = {
                url: 'http://market.com',
                body: JSON.stringify(body)
            };

            const config = {
                proxy: {
                    enabled: false
                },
                host: 'market.com',
                port: 8004,
                localEORI: 'MARKET',
                ishareKey: './market.key',
                ishareCrt: './market.crt'
            }

            const schemaInstance = {
                save: (callback) => {
                    callback();
                }
            };
            const schema = function () {
                return schemaInstance;
            };

            const idpController = getIDPController(schema, config);
            const processor = jasmine.createSpy('processor');

            const res = jasmine.createSpyObj('res', ['setHeader', 'end']);
            res.end = () => {
                expect(schemaInstance.name).toEqual('Test IDP');
                expect(schemaInstance.idpId).toEqual('IDP');
                expect(schemaInstance.server).toEqual('http://ipdserver.com');
                expect(schemaInstance.description).toEqual('Test description');
                expect(schemaInstance.provider).toEqual('i4trust');
                expect(schemaInstance.clientID).toEqual('MARKET');
                expect(schemaInstance.tokenKey).toEqual('./market.key');
                expect(schemaInstance.tokenCrt).toEqual('./market.crt');
                expect(schemaInstance.callbackURL).toEqual('http://market.com:8004/auth/IDP/callback')

                expect(res.statusCode).toEqual(200);
                expect(res.setHeader).toHaveBeenCalledWith('location', 'http://market.com/IDP')

                expect(processor).toHaveBeenCalledWith(schemaInstance);
                done();
            }

            idpController.setNewIdpProcessor(processor);
            idpController.createIdp(req, res);
        });
    });

    describe('Delete IDP', () => {
    });

    describe('Update IDP', () => {
    });
})
