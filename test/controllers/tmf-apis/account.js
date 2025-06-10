/* Copyright (c) 2024 Future Internet Consulting and Development Solutions S.L.
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
const testUtils = require('../../utils');


describe('Account API', () => {

    const apiPath = '/api';
    const path = '/account'
    const billingPath = path +'/billingAccount'
    const userId = 'urn:individual:1234'
    const config = testUtils.getDefaultConfig();

    const getAccountAPI = function(tmfUtils, utils) {
		return proxyquire('../../../controllers/tmf-apis/account', {
			'./../../config': config,
			'./../../lib/logger': testUtils.emptyLogger,
			'./../../lib/tmfUtils': tmfUtils,
			'./../../lib/utils': utils
		}).account;
	};

    beforeEach(function() {
		nock.cleanAll();
	});

    const validateError = function(status, msg, req, callback) {
        callback({
            status: status,
            message: msg
        });
    }

    const testPipelineError = function(utils, method, status, msg, done) {
        const accountAPI = getAccountAPI({}, utils);
        const req = {
            method: method,
            url: path,
            apiUrl: path
        };

        accountAPI.checkPermissions(req, (err) => {
            expect(err).not.toBe(null);
            expect(err.status).toBe(status);
            expect(err.message).toBe(msg);

            done();
        });
    }

    describe('Not authenticated', () => {
        const status = 401
        const msg = 'You need to be authenticated to get/create/update accounts'

        const validateLoggedError = function(req, callback) {
            validateError(status, msg, req, callback)
        };

        const testNotLoggedIn = function(method, done) {
            const utils = {
                validateLoggedIn: validateLoggedError
            };

            testPipelineError(utils, method, 401, 'You need to be authenticated to get/create/update accounts', done)
        };

        it('should not allow a GET request', (done) => {
            testNotLoggedIn('GET', done)
        })

        it('should not allow a POST request', (done) => {
            testNotLoggedIn('POST', done)
        })

        it('should not allow a PATCH request', (done) => {
            testNotLoggedIn('PATCH', done)
        })
    })

    describe('Not allowed method', () => {
        const status = 405
        const msg = 'Method not allowed'

        const validateNotAllowedError = function(req, callback) {
            validateError(status, msg, req, callback)
        };

        const testNotAllowed = function(method, done) {
            const utils = {
                methodNotAllowed: validateNotAllowedError
            };

            testPipelineError(utils, method, status, msg, done)
        };

        it('should not allow a PUT request', (done) => {
            testNotAllowed('PUT', done)
        })

        it('should not allow a DELETE request', (done) => {
            testNotAllowed('DELETE', done)
        })
    })

    describe('Validate retrieval', () => {

        it('should redirect the request when the relatedParty is included', (done) => {
            const req = {
                method: 'GET',
                apiUrl: `${path}?relatedParty=${userId}`,
                query: {
                    relatedParty: userId
                },
                user: {
                    partyId: userId
                }
            }

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                }
            })
            accountAPI.checkPermissions(req, (err) => {
                expect(err).toBe(null);
                done();
            });
        })

        it('should redirect the request when the relatedParty is not included', (done) => {
            const req = {
                method: 'GET',
                apiUrl: path,
                query: {},
                user: {
                    partyId: userId
                }
            }

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                }
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).toBe(null);
                // The related party field must had been included
                expect(req.apiUrl).toEqual(`${path}?relatedParty.id=${userId}`)
                done();
            });
        })

        it('should not redirect the request when the relatedParty is included and not valid', (done) => {
            const req = {
                method: 'GET',
                apiUrl: `${path}?relatedParty.id=invalid`,
                query: {
                    'relatedParty.id': 'invalid'
                },
                user: {
                    partyId: userId
                }
            }

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                }
            })
            accountAPI.checkPermissions(req, (err) => {
                expect(err).not.toBe(null);
                expect(err.status).toBe(403)
                expect(err.message).toBe('You are not authorized to retrieve the entities made by the user invalid')
                done();
            });
        })
    })

    describe('Validate account creation', () => {

        it('should redirect the creation request if the info is valid', (done) => {
            const req = {
                method: 'POST',
                apiUrl: path,
                user: {
                    partyId: userId
                },
                body: JSON.stringify({
                    relatedParty: [{
                        id: userId,
                        role: 'owner'
                    }]
                })
            }

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                }
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).toBe(null);
                done();
            });
        })

        it('should not redirect the creation request if relatedParty is missing', (done) => {
            const req = {
                method: 'POST',
                apiUrl: path,
                user: {
                    partyId: userId
                },
                body: JSON.stringify({})
            }

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                }
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).not.toBe(null);
                expect(err.status).toBe(400)
                expect(err.message).toBe('Missing relatedParty field')
                done();
            });
        })

        it('should not redirect the creation request if relatedParty is invalid', (done) => {
            const req = {
                method: 'POST',
                apiUrl: path,
                user: {
                    partyId: userId
                },
                body: JSON.stringify({
                    relatedParty: [{
                        id: 'invalid',
                        role: 'owner'
                    }]
                })
            }

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                }
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).not.toBe(null);
                expect(err.status).toBe(403)
                expect(err.message).toBe('The user making the request is not the specified owner')
                done();
            });
        })
    })

    describe('Validate billingAccount creation', () => {

        it('should redirect the creation request if contact is valid', (done) => {
            const req = {
                method: 'POST',
                apiUrl: billingPath,
                user: {
                    partyId: userId
                },
                body: JSON.stringify({
                    contact: [{
                        contactMedium: [{mediumType: "Email"},{mediumType: "PostalAddress",},
                            {
                                mediumType: "TelephoneNumber",
                                preferred: true,
                                characteristic: {
                                    "contactType": "Mobile",
                                    "phoneNumber": "+34650546882" // correct
                                }
                            }
                        ]
                        }],
                    relatedParty: [{
                        id: userId,
                        role: 'owner'
                    }]
                })
            }

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                },
                isValidPhoneNumber: (_) => true
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).toBe(null);
                done();
            });
        })

        it('should not redirect the creation request if contact is not an array', (done) => {
            const req = {
                method: 'POST',
                apiUrl: billingPath,
                user: {
                    partyId: userId
                },
                body: JSON.stringify({
                    contact: {
                        contactMedium: [{mediumType: "Email"},{mediumType: "PostalAddress",},
                            {
                                mediumType: "TelephoneNumber",
                                preferred: true,
                                characteristic: {
                                    "contactType": "Mobile",
                                    "phoneNumber": "+34650546882" // correct
                                }
                            }
                        ]
                        },
                    relatedParty: [{
                        id: userId,
                        role: 'owner'
                    }]
                })
            }

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                },
                isValidPhoneNumber: (_) => true
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).not.toBe(null);
                expect(err.status).toBe(400)
                expect(err.message).toBe('Invalid contact format')
                done();
            });
        })
        it('should not redirect the creation request if contactMedium is not an array', (done) => {
            const req = {
                method: 'POST',
                apiUrl: billingPath,
                user: {
                    partyId: userId
                },
                body: JSON.stringify({
                    contact: [{
                        contactMedium: {
                            mediumType: "Email"
                        }
                    }],
                    relatedParty: [{
                        id: userId,
                        role: 'owner'
                    }]
                })
            }
            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                },
                isValidPhoneNumber: (_) => true
            })
            accountAPI.checkPermissions(req, (err) => {
                expect(err).not.toBe(null);
                expect(err.status).toBe(400)
                expect(err.message).toBe('Invalid contactMedium format')
                done();
            });
        })

        it('should not redirect the creation request if tmfUtil number validator returns false', (done) => {
            const req = {
                method: 'POST',
                apiUrl: billingPath,
                user: {
                    partyId: userId
                },
                body: JSON.stringify({
                    contact: [{
                        contactMedium: [
                            {
                                mediumType: "Email",
                            },
                            {
                                mediumType: "PostalAddress",
                            },
                            {
                                mediumType: "TelephoneNumber",
                                preferred: true,
                                characteristic: {
                                    "contactType": "Mobile",
                                    "phoneNumber": "+34550546882"
                                }
                            }
                        ]
                    }],
                    relatedParty: [{
                        id: userId,
                        role: 'owner'
                    }]
                })
            }

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                },
                isValidPhoneNumber: (_) => false
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).not.toBe(null);
                expect(err.status).toBe(422)
                expect(err.message).toBe('Invalid phone number')
                done();
            });
        })

        it('should not redirect the creation request if relatedParty is missing', (done) => {
            const req = {
                method: 'POST',
                apiUrl: billingPath,
                user: {
                    partyId: userId
                },
                body: JSON.stringify({})
            }

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                }
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).not.toBe(null);
                expect(err.status).toBe(400)
                expect(err.message).toBe('Missing relatedParty field')
                done();
            });
        })

        it('should not redirect the creation request if relatedParty is invalid', (done) => {
            const req = {
                method: 'POST',
                apiUrl: billingPath,
                user: {
                    partyId: userId
                },
                body: JSON.stringify({
                    relatedParty: [{
                        id: 'invalid',
                        role: 'owner'
                    }]
                })
            }

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                }
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).not.toBe(null);
                expect(err.status).toBe(403)
                expect(err.message).toBe('The user making the request is not the specified owner')
                done();
            });
        })
    })
    describe('Validate account update', () => {
        const protocol = config.endpoints.account.appSsl ? 'https' : 'http';
	    const url = protocol + '://' + config.endpoints.account.host + ':' + config.endpoints.account.port;

        const req = {
            method: 'PATCH',
            apiUrl: `/${config.endpoints.account.path}${path}`,
            user: {
                partyId: userId
            },
            body: JSON.stringify({})
        }

        const mockNock = function(status, nockBody) {
            nock(url).get(apiPath + path).reply(status, nockBody)
        }

        it('should redirect the request when the info is valid', (done) => {
            mockNock(200, {
                relatedParty: [{
                    id: userId,
                    role: 'owner'
                }]
            })

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                }
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).toBe(null);
                done();
            });
        })

        it('should not redirect the request when the user is not the owner', (done) => {
            mockNock(200, {
                relatedParty: [{
                    id: 'other',
                    role: 'owner'
                }]
            })

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                }
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).not.toBe(null);
                expect(err.status).toBe(403)
                expect(err.message).toBe('The user making the request is not the specified owner')
                done();
            });
        })

        it('should not redirect the request when the account cannot be retrieved', (done) => {
            mockNock(500, {})

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                }
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).not.toBe(null);
                expect(err.status).toBe(500)
                done();
            });
        })
    })
    describe('Validate billingAccount update', () => {
        const protocol = config.endpoints.account.appSsl ? 'https' : 'http';
	    const url = protocol + '://' + config.endpoints.account.host + ':' + config.endpoints.account.port;
        const billingId = 1

        const req = {
            method: 'PATCH',
            apiUrl: `${billingPath}/${billingId}`,
            user: {
                partyId: userId
            },
            body: JSON.stringify({})
        }

        const mockNock = function(status, nockBody) {
            nock(url).get(`${apiPath}/billingAccount/${billingId}`).reply(status, nockBody)
        }

        it('should redirect the request when the info is valid', (done) => {
            mockNock(200, {
                id: billingId,
                relatedParty: [{
                    id: userId,
                    role: 'owner'
                }]
            })
            req.body = JSON.stringify({
                contact: [{
                contactMedium: [
                    {
                        mediumType: "Email",
                    },
                    {
                        mediumType: "PostalAddress",
                    },
                    {
                        mediumType: "TelephoneNumber",
                        preferred: true,
                        characteristic: {
                            "contactType": "Mobile",
                            "phoneNumber": "+34650546882"
                        }
                    }
                ]
            }]})

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                },
                isValidPhoneNumber: (_) => true
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).toBe(null);
                done();
            });
        })

        it('should not redirect the request when tmfutils number validator returns false', (done) => {
            mockNock(200, {
                id: billingId,
                relatedParty: [{
                    id: userId,
                    role: 'owner'
                }]
            })

            req.body = JSON.stringify({
                contact: [{
                contactMedium: [
                    {
                        mediumType: "Email",
                    },
                    {
                        mediumType: "PostalAddress",
                    },
                    {
                        mediumType: "TelephoneNumber",
                        preferred: true,
                        characteristic: {
                            "contactType": "Mobile",
                            "phoneNumber": "+342505468821"
                        }
                    }
                ]
            }],})

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                },
                isValidPhoneNumber: (_) => false
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).not.toBe(null);
                expect(err.status).toBe(422)
                expect(err.message).toBe('Invalid phone number')
                done();
            });
        })

        it('should not redirect the request when the user is not the owner', (done) => {
            mockNock(200, {
                id: billingId,
                relatedParty: [{
                    id: 'other',
                    role: 'owner'
                }]
            })

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                }
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).not.toBe(null);
                expect(err.status).toBe(403)
                expect(err.message).toBe('The user making the request is not the specified owner')
                done();
            });
        })

        it('should not redirect the request when the account cannot be retrieved', (done) => {
            mockNock(500, {})

            const accountAPI = getAccountAPI({}, {
                validateLoggedIn: (req, callback) => {
                    callback(null)
                }
            })

            accountAPI.checkPermissions(req, (err) => {
                expect(err).not.toBe(null);
                expect(err.status).toBe(500)
                done();
            });
        })
    })
})