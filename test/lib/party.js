/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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
const nock = require('nock');
const proxyquire = require('proxyquire');
const testUtils = require('../utils');

describe('Party lib', function() {
    const config = testUtils.getDefaultConfig();

    const url = 'http://' + config.endpoints.party.host + ':' + config.endpoints.party.port;

    const partyClient = function(path) {
        return proxyquire('../../lib/party', {
            '../config.js': config,
            './utils.js': {
                getAPIURL: function() {
                    return url + path;
                }
            }
        }).partyClient;
    };

    const headers = {
        'content-type': 'application/json',
        accept: 'application/json'
    };

    const FUNCTION_MAPPING = {};
    FUNCTION_MAPPING['getOrg'] = 'getOrganization';
    FUNCTION_MAPPING['getOrgs'] = 'getOrganizations';
    FUNCTION_MAPPING['mkOrg'] = 'createOrganization';
    FUNCTION_MAPPING['updOrg'] = 'updateOrganization';
    FUNCTION_MAPPING['getInd'] = 'getIndividual';
    FUNCTION_MAPPING['getInds'] = 'getIndividuals';
    FUNCTION_MAPPING['mkInd'] = 'createIndividual';
    FUNCTION_MAPPING['updInd'] = 'updateIndividual';

    const orgPath = '/organization/';
    const orgId = '111555999';
    const indPath = '/individual/';
    const indId = 'eugenio';

    const orgPartyClient = partyClient(orgPath);
    const indPartyClient = partyClient(indPath);

    describe('Party API error cases', function() {
        const testOrganzationUnexpected = function(path, method, done) {
            const errObj = {
                error: 'The connection has failed while requesting all the organizations of the party API'
            };

            const expected = {
                status: 500,
                message: 'Service unreachable',
                body: errObj
            }

            nock(url, {
                reqheaders: headers
            })
                .get(path)
                .reply(500, errObj);

            const orgPartyClient = partyClient(path);
            orgPartyClient[FUNCTION_MAPPING[method]]().catch((err) => {
                expect(err).toEqual(expected);
                done()
            })
        }

        it('getOrganizations should return error fields if req fails', function(done) {
            testOrganzationUnexpected(orgPath, 'getOrgs', done)
        });

        it('getOrganization should return error fields if req fails', function(done) {
            const orgP = orgPath + orgId;
            testOrganzationUnexpected(orgP, 'getOrg', done)
        });

        it('createOrganization should return error fields if req fails', function(done) {
            const errObj = {
                message: 'The connection has failed while creating the organization'
            };

            const expected = {
                status: 500,
                message: 'Service unreachable',
                body: errObj
            }

            nock(url, {
                reqheaders: headers
            })
                .post(orgPath)
                .reply(500, errObj);

            const content = {
                id: '111555999',
                tradingName: 'AmaneceQueNoEsPoco',
                href: 'http://exampleuri.com/lack/of/imagination'
            };

            orgPartyClient[FUNCTION_MAPPING['mkOrg']](content).catch((err) => {
                expect(err).toEqual(expected);
                done()
            })
        });

        it('updateOrganization should return error fields if req fails', function(done) {
            const orgP = orgPath + orgId;
            const orgPartyClient = partyClient(orgP);

            const errObj = {
                message: 'The connection has failed while updating the organization'
            };

            const expected = {
                status: 500,
                message: 'Service unreachable',
                body: errObj
            }

            nock(url, {
                reqheaders: headers
            })
                .patch(orgP)
                .reply(500, errObj);

            const content = {
                tradingName: 'LifeOfBrian'
            };

            orgPartyClient[FUNCTION_MAPPING['updOrg']](orgId, content).catch((err) => {
                expect(err).toEqual(expected);
                done()
            })
        });

        const testInvidualsUnexpected = function(path, method, indId, done) {
            const errObj = {
                message: 'The connection has failed getting user info'
            };

            const expected = {
                status: 500,
                message: 'Service unreachable',
                body: errObj
            }

            nock(url, {
                reqheaders: headers
            })
                .get(path)
                .reply(500, errObj);

            const indPartyClient = partyClient(path);
            indPartyClient[FUNCTION_MAPPING[method]](indId).catch((err) => {
                expect(err).toEqual(expected)
                done()
            })
        }

        it('getIndividual should return error fields if req fails', function(done) {
            const indP = indPath + indId;
            testInvidualsUnexpected(indP, 'getInd', indId, done)
        });

        it('getIndividuals should return error fields if req fails', function(done) {
            testInvidualsUnexpected(indPath, 'getInds', null, done)
        });

        it('createIndividual should return error fields if req fails', function(done) {
            const errObj = {
                message: 'The connection has failed while creating the individual'
            };

            const expected = {
                status: 500,
                message: 'Service unreachable',
                body: errObj
            }

            nock(url, {
                reqheaders: headers
            })
                .post(indPath)
                .reply(500, errObj);

            const content = {
                id: '111555999',
                name: 'Vercingetorix',
            };

            indPartyClient[FUNCTION_MAPPING['mkInd']](content).catch((err) => {
                expect(err).toEqual(expected);
                done();
            });
        });

        it('updateIndividual should return error fields if req fails', function(done) {
            const indP = indPath + indId;
            const indPartyClient = partyClient(indP);

            const errObj = {
                message: 'The connection has failed while updating the individual'
            };

            const expected = {
                status: 500,
                message: 'Service unreachable',
                body: errObj
            }

            nock(url, {
                reqheaders: headers
            })
                .patch(indP)
                .reply(500, errObj);

            const content = {
                title: 'Sir lancelot of the Holy Grial'
            };

            indPartyClient[FUNCTION_MAPPING['updInd']](indId, content).catch((err) => {
                expect(err).toEqual(expected);
                done();
            });
        });
    });

    describe('Party API success cases', function() {
        it('getOrganizations should return the list of all organizations', function(done) {
            const expectedValue = [
                {
                    id: '111555999',
                    href: 'www.example.org/org/1'
                },
                {
                    id: '123456789',
                    href: 'www.example.org/org/2'
                }
            ];
            nock(url, {
                reqheaders: headers
            })
                .get(orgPath)
                .reply(200, expectedValue);

            orgPartyClient[FUNCTION_MAPPING['getOrgs']]().then((res) => {
                expect(res.body).toEqual(expectedValue);
                done();
            });
        });

        it('getOrganization should return the required organization', function(done) {
            const orgP = orgPath + orgId;
            const orgPartyClient = partyClient(orgP);

            const expectedValue = {
                id: '111555999',
                href: 'www.example.org/org/1'
            };

            nock(url, {
                reqheaders: headers
            })
                .get(orgP)
                .reply(200, expectedValue);

            orgPartyClient[FUNCTION_MAPPING['getOrg']](orgId).then((res) => {
                expect(res.body).toEqual(expectedValue);
                expect(res.status).toEqual(200)
                done();
            });
        });

        it('createOrganization should return the created organization', function(done) {
            const content = {
                id: '111555999',
                tradingName: 'AmaneceQueNoEsPoco',
                href: 'http://exampleuri.com/lack/of/imagination'
            };

            nock(url, {
                reqheaders: headers
            })
                .post(orgPath)
                .reply(201, content);

            orgPartyClient[FUNCTION_MAPPING['mkOrg']](content).then((res) => {
                expect(res.body).toEqual(content);
                expect(res.status).toEqual(201)
                done();
            });
        });

        it('updateOrganization should return the organization updated', function(done) {
            const orgP = orgPath + orgId;
            const orgPartyClient = partyClient(orgP);

            const expectedValue = {
                id: '111555999',
                tradingName: 'AmaneceQueNoEsPoco'
            };

            nock(url, {
                reqheaders: headers
            })
                .patch(orgP)
                .reply(200, expectedValue);

            const content = {
                tradingName: 'LifeOfBrian'
            };

            orgPartyClient[FUNCTION_MAPPING['updOrg']](orgId, content).then((res) => {
                expect(res.body).toEqual(expectedValue);
                expect(res.status).toEqual(200)
                done();
            });
        });

        it('getIndividuals should return the required individuals', function(done) {
            const expectedValue = [
                {
                    id: '111555999',
                    href: 'Vercingetorix'
                },
                {
                    id: '123456789',
                    href: 'Celtilo'
                }
            ];
            nock(url, {
                reqheaders: headers
            })
                .get(orgPath)
                .reply(200, expectedValue);

            orgPartyClient[FUNCTION_MAPPING['getInds']]().then((res) => {
                expect(res.body).toEqual(expectedValue);
                expect(res.status).toEqual(200)
                done();
            });
        });

        it('getIndividual should return the required Individual', function(done) {
            const indP = indPath + indId;
            const indPartyClient = partyClient(indP);

            const ind = {
                id: '111555999',
                name: 'Vercingetorix'
            };

            nock(url, {
                reqheaders: headers
            })
                .get(indP)
                .reply(200, ind);

            indPartyClient[FUNCTION_MAPPING['getInd']](indId).then((res) => {
                expect(res.body).toEqual(ind);
                expect(res.status).toEqual(200)
                done();
            });
        });

        it('createIndividual should return the created individual', function(done) {
            const content = {
                id: '111555999',
                name: 'Vercigentorix'
            };

            nock(url, {
                reqheaders: headers
            })
                .post(indPath)
                .reply(201, content);

            indPartyClient[FUNCTION_MAPPING['mkInd']](content).then((res) => {
                expect(res.body).toEqual(content);
                expect(res.status).toEqual(201)
                done();
            });
        });

        it('updateIndividual should return the individual updated', function(done) {
            const indP = indPath + indId;
            const indPartyClient = partyClient(indP);

            const content = {
                title: 'Sir lancelot of the Holy Grial'
            };

            nock(url, {
                reqheaders: headers
            })
                .patch(indP)
                .reply(200, content);

            indPartyClient[FUNCTION_MAPPING['updInd']](indId, content).then((res) => {
                expect(res.body).toEqual(content);
                expect(res.status).toEqual(200)
                done();
            });
        });
    });
});
