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


const nock = require('nock')
const moment = require('moment')
const proxyquire = require('proxyquire')

describe('VC Certs', () => {
    const serverUrl = 'http://verifier.com'
    const tokenPath = '/token'
    const jwksPath = '/jwks'
    const callback = 'http://bae.com/callback'

    function mockResponse() {
        const res = jasmine.createSpyObj('res', ['status', 'end'])
        const jsonCall = jasmine.createSpyObj('json', ['json'])
        const end = jasmine.createSpyObj('end', ['end'])

        jsonCall.json.and.returnValue(end)
        res.status.and.returnValue(jsonCall)

        return {
            res: res,
            json: jsonCall
        }
    }

    describe('Load VC', () => {
        const state = 'state'
        const code = 'code'

        const token = 'myaccesstokenvc'
        const tokenResponse = {
            access_token: token
        }
        const req = {
            query: {
                state: state,
                code: code
            }
        }

        function getCertLib(cache, config) {
            const MockedNodeCache = function() {
                return cache
            }

            return proxyquire('../../lib/certificate', {
                '../config': {
                    siop: config
                },
                'node-cache': MockedNodeCache
            })
        }

        it('should load and validate the VC credential', (done) => {
            let receivedBody;
            // Mock verifier request
            nock(serverUrl, {
                reqheaders: {
                    'content-type': 'application/x-www-form-urlencoded'
                }
            }).post(tokenPath, (body) => {
                receivedBody = body;
                return true;
            }).reply(200, tokenResponse);

            const cache = jasmine.createSpyObj('cache', ['set'])

            // Mock JWT and JWKS
            const certs = getCertLib(cache, {
                verifierHost: serverUrl,
                verifierTokenPath: tokenPath,
                verifierJWKSPath: jwksPath,
                callbackURL: callback
            })

            const resMock = mockResponse()

            // Call the tested method
            certs.certsValidator.loadCredential(req, resMock.res).then(() => {
                // Verify calls
                expect(receivedBody).toEqual({
                    'code': code,
                    'grant_type': 'authorization_code',
                    'redirect_uri': callback
                })

                expect(cache.set).toHaveBeenCalledWith(state, token)

                expect(resMock.res.status).toHaveBeenCalledWith(200)
                done()
            })
        })
    
        function testMissingParam(req, done) {
            const cache = jasmine.createSpyObj('cache', ['set'])
            const certs = getCertLib(cache, {})

            const resMock = mockResponse()

            certs.certsValidator.loadCredential(req, resMock.res).then(() => {
                expect(resMock.res.status).toHaveBeenCalledWith(400)
                expect(resMock.json.json).toHaveBeenCalledWith({
                    error: 'Missing required param: state and code'
                })
                done()
            })
        }

        it('should raise an error if state param is missing', (done) => {
            testMissingParam({
                query: {
                    code: code
                }
            }, done)
        })
    
        it('should raise an error if code param is missing', (done) => {
            testMissingParam({
                query: {
                    state: state,
                }
            }, done)
        })
    
        it('should raise an error if the VC token cannot be retrieved', (done) => {
            nock(serverUrl, {
                reqheaders: {
                    'content-type': 'application/x-www-form-urlencoded'
                }
            }).post(tokenPath, () => {
                return true;
            }).reply(400, {});

            const cache = jasmine.createSpyObj('cache', ['set'])

            const certs = getCertLib(cache, {
                verifierHost: serverUrl,
                verifierTokenPath: tokenPath,
                verifierJWKSPath: jwksPath,
                callbackURL: callback
            })

            const resMock = mockResponse()
            
            certs.certsValidator.loadCredential(req, resMock.res).then(() => {
                expect(resMock.res.status).toHaveBeenCalledWith(500)
                expect(resMock.json.json).toHaveBeenCalledWith({
                    error: 'Error loading VC'
                })
                done()
            })
        })
    })

    describe('Check status', () => {
        const state = '1234'
        const kid = 'kid'
        const issuer = 'did:web:dekra.com'
        const decodedVC = {
            kid: kid,
            verifiableCredential: {
                issuer: {
                    did: issuer
                },
                subject: {
                    product: {},
                    company: {},
                    compliance: {}
                },
                expirationDate: moment().utc().add(30, 'days').toISOString()
            }
        }

        function getCertLib(cache, jwks, jwt, config) {
            const MockedNodeCache = function() {
                return cache
            }

            return proxyquire('../../lib/certificate', {
                '../config': {
                    siop: config
                },
                'jwks-rsa': jwks,
                'jsonwebtoken': jwt,
                'node-cache': MockedNodeCache
            })
        }

        it('should return the VC if already loaded', (done) => {
            const vc = 'myvctoken'

            const cache = jasmine.createSpyObj('cache', ['get', 'del'])
            cache.get.and.returnValue(vc)

            const req = {
                query: {
                    state: state
                }
            }
            const mockRes = mockResponse()

            const jwt = jasmine.createSpyObj('jwt', ['decode', 'verify'])

            jwt.decode.and.returnValue(decodedVC)

            const jwksClient = jasmine.createSpy('jwksClient')
            const jwks = jasmine.createSpyObj('jwks', ['getSigningKey'])

            jwksClient.and.returnValue(jwks)

            const keyMock = jasmine.createSpyObj('keyMock', ['getPublicKey'])

            const pubKey = 'publicKey'
            keyMock.getPublicKey.and.returnValue(pubKey)

            jwks.getSigningKey.and.returnValue(new Promise((resolve, reject) => {
                resolve(keyMock)
            }))

            const certs = getCertLib(cache, jwksClient, jwt, {
                certIssuers: [issuer],
                verifierHost: serverUrl,
                verifierTokenPath: tokenPath,
                verifierJWKSPath: jwksPath,
                callbackURL: callback
            })

            // Call the tested method
            certs.certsValidator.checkStatus(req, mockRes.res).then(() => {
                // Check calls
                expect(cache.get).toHaveBeenCalledWith(state)
                expect(cache.del).toHaveBeenCalledWith(state)

                expect(jwt.decode).toHaveBeenCalledWith(vc)
                expect(jwt.verify).toHaveBeenCalledWith(vc, pubKey)

                expect(jwksClient).toHaveBeenCalledWith({
                    jwksUri: serverUrl + jwksPath
                })
                expect(jwks.getSigningKey).toHaveBeenCalledWith(kid)
                expect(keyMock.getPublicKey).toHaveBeenCalledWith()

                expect(mockRes.res.status).toHaveBeenCalledWith(200)
                expect(mockRes.json.json).toHaveBeenCalledWith({
                    vc: vc,
                    subject: decodedVC.verifiableCredential.subject
                })
                done()
            })
        })

        it('should raise an error if the state is not provided', (done) => {
            const cache = jasmine.createSpyObj('cache', ['get', 'del'])
            const certs = getCertLib(cache, {}, {}, {})

            const req = {
                query: {}
            }
            const mockRes = mockResponse()

            // Call the tested method
            certs.certsValidator.checkStatus(req, mockRes.res).then(() => {
                // Check calls
                expect(mockRes.res.status).toHaveBeenCalledWith(400)
                expect(mockRes.json.json).toHaveBeenCalledWith({
                    error: 'Missing required param: state'
                })
                done()
            })
        })

        it('should send unauthorize code if the VC is not yet loaded', (done) => {
            const cache = jasmine.createSpyObj('cache', ['get', 'del'])
            cache.get.and.returnValue(null)

            const req = {
                query: {
                    state: state
                }
            }
            const mockRes = mockResponse()
            const certs = getCertLib(cache, {}, {}, {})

            // Call the tested method
            certs.certsValidator.checkStatus(req, mockRes.res).then(() => {
                // Check calls
                expect(cache.get).toHaveBeenCalledWith(state)
                expect(cache.del).not.toHaveBeenCalledWith(state)

                expect(mockRes.res.status).toHaveBeenCalledWith(401)
                expect(mockRes.json.json).toHaveBeenCalledWith({
                    error: 'VC not found'
                })
                done()
            })
        })

        function testInvalidVC(jwt, msg, done) {
            const vc = 'myvctoken'
            const req = {
                query: {
                    state: state
                }
            }

            const cache = jasmine.createSpyObj('cache', ['get', 'del'])
            cache.get.and.returnValue(vc)

            const certs = getCertLib(cache, {}, jwt, {
                verifierHost: serverUrl,
                verifierTokenPath: tokenPath,
                verifierJWKSPath: jwksPath,
                callbackURL: callback
            })

            const resMock = mockResponse()

            // Call the tested method
            certs.certsValidator.checkStatus(req, resMock.res).then(() => {
                // Verify calls
                expect(jwt.decode).toHaveBeenCalledWith(vc)

                expect(resMock.res.status).toHaveBeenCalledWith(400)
                expect(resMock.json.json).toHaveBeenCalledWith({
                    error: msg
                })
                done()
            })
        }

        it('should raise an error if VC cannot be decoded', (done) => {
            // Mock verifier request
            const jwt = jasmine.createSpyObj('jwt', ['decode', 'verify'])
            jwt.decode.and.throwError(new Error('Decoding error'))
            testInvalidVC(jwt, 'Invalid VC', done)
        })
    
        it('should raise an error if VC has a wrong format', (done) => {
            const jwt = jasmine.createSpyObj('jwt', ['decode', 'verify'])
            jwt.decode.and.returnValue({
                invalid: 'format'
            })
            testInvalidVC(jwt, 'Invalid VC token format', done)
        })

        it('should raise an error if VC signature cannot be checked', (done) => {
            const vc = 'myvctoken'
            const req = {
                query: {
                    state: state
                }
            }

            const cache = jasmine.createSpyObj('cache', ['get', 'del'])
            cache.get.and.returnValue(vc)

            const jwt = jasmine.createSpyObj('jwt', ['decode', 'verify'])

            jwt.decode.and.returnValue(decodedVC)

            const jwksClient = jasmine.createSpy('jwksClient')
            const jwks = jasmine.createSpyObj('jwks', ['getSigningKey'])

            jwksClient.and.returnValue(jwks)
            jwks.getSigningKey.and.throwError(new Error('Error'))

            // Mock JWT and JWKS
            const certs = getCertLib(cache, jwksClient, jwt, {
                verifierHost: serverUrl,
                verifierTokenPath: tokenPath,
                verifierJWKSPath: jwksPath,
                callbackURL: callback
            })

            const resMock = mockResponse()

            // Call the tested method
            certs.certsValidator.checkStatus(req, resMock.res).then(() => {
                // Verify calls
                expect(jwt.decode).toHaveBeenCalledWith(vc)
                expect(jwksClient).toHaveBeenCalledWith({
                    jwksUri: serverUrl + jwksPath
                })
                expect(jwks.getSigningKey).toHaveBeenCalledWith(kid)

                expect(resMock.res.status).toHaveBeenCalledWith(400)
                expect(resMock.json.json).toHaveBeenCalledWith({
                    error: 'Invalid VC'
                })
                done()
            })
        })

        function testInvalidDecodedVC(decodedCred, msg, done) {
            const vc = 'myvctoken'
            const req = {
                query: {
                    state: state
                }
            }

            const cache = jasmine.createSpyObj('cache', ['get', 'del'])
            cache.get.and.returnValue(vc)

            const jwt = jasmine.createSpyObj('jwt', ['decode', 'verify'])

            jwt.decode.and.returnValue(decodedCred)

            const jwksClient = jasmine.createSpy('jwksClient')
            const jwks = jasmine.createSpyObj('jwks', ['getSigningKey'])

            jwksClient.and.returnValue(jwks)

            const keyMock = jasmine.createSpyObj('keyMock', ['getPublicKey'])

            const pubKey = 'publicKey'
            keyMock.getPublicKey.and.returnValue(pubKey)

            jwks.getSigningKey.and.returnValue(new Promise((resolve, reject) => {
                resolve(keyMock)
            }))

            const certs = getCertLib(cache, jwksClient, jwt, {
                certIssuers: [issuer],
                verifierHost: serverUrl,
                verifierTokenPath: tokenPath,
                verifierJWKSPath: jwksPath,
                callbackURL: callback
            })

            const resMock = mockResponse()

            // Call the tested method
            certs.certsValidator.checkStatus(req, resMock.res).then(() => {
                // Verify calls
                expect(jwt.decode).toHaveBeenCalledWith(vc)

                expect(resMock.res.status).toHaveBeenCalledWith(400)
                expect(resMock.json.json).toHaveBeenCalledWith({
                    error: msg
                })
                done()
            })
        }

        it('should raise an error if verifiable credential is not provided', (done) => {
            testInvalidDecodedVC({
                kid: kid
            }, 'Invalid VC', done)
        })

        it('should raise an error if issuer is not provided', (done) => {
            testInvalidDecodedVC({
                kid: kid,
                verifiableCredential: {
                    subject: {
                        product: {},
                        company: {},
                        compliance: {}
                    },
                    expirationDate: moment().utc().add(30, 'days').toISOString()
                }
            }, 'Invalid VC issuer', done)
        })

        it('should raise an error if issuer is not valid', (done) => {
            testInvalidDecodedVC({
                kid: kid,
                verifiableCredential: {
                    issuer: {
                        did: 'invalid'
                    },
                    subject: {
                        product: {},
                        company: {},
                        compliance: {}
                    },
                    expirationDate: moment().utc().add(30, 'days').toISOString()
                }
            }, 'Invalid VC issuer', done)
        })

        it('should raise an error if VC is expired', (done) => {
            testInvalidDecodedVC({
                kid: kid,
                verifiableCredential: {
                    issuer: {
                        did: issuer
                    },
                    subject: {
                        product: {},
                        company: {},
                        compliance: {}
                    },
                    expirationDate: moment().utc().subtract(30, 'days').toISOString()
                }
            }, 'The VC is expired', done)
        })

        it('should raise an error if VC expired field is invalid', (done) => {
            testInvalidDecodedVC({
                kid: kid,
                verifiableCredential: {
                    issuer: {
                        did: issuer
                    },
                    subject: {
                        product: {},
                        company: {},
                        compliance: {}
                    },
                    expirationDate: 'invalid'
                }
            }, 'The VC is expired', done)
        })

        it('should raise an error if subject is missing', (done) => {
            testInvalidDecodedVC({
                kid: kid,
                verifiableCredential: {
                    issuer: {
                        did: issuer
                    },
                    expirationDate: moment().utc().add(30, 'days').toISOString()
                }
            }, 'Invalid VC subject', done)
        })

        it('should raise an error if product subject is missing', (done) => {
            testInvalidDecodedVC({
                kid: kid,
                verifiableCredential: {
                    issuer: {
                        did: issuer
                    },
                    subject: {
                        company: {},
                        compliance: {}
                    },
                    expirationDate: moment().utc().add(30, 'days').toISOString()
                }
            }, 'Invalid VC subject', done)
        })

        it('should raise an error if VC compliance is missing', (done) => {
            testInvalidDecodedVC({
                kid: kid,
                verifiableCredential: {
                    issuer: {
                        did: issuer
                    },
                    subject: {
                        product: {},
                        company: {},
                    },
                    expirationDate: moment().utc().add(30, 'days').toISOString()
                }
            }, 'Invalid VC subject', done)
        })
    })
})


