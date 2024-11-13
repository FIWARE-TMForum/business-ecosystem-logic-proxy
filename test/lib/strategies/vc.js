
const proxyquire = require('proxyquire');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const MockStrategy = require('../../utils').MockStrategy;

describe('VC Strategy', () => {
    const buildStrategyMock = (passport) => {
        return proxyquire('../../../lib/strategies/vc', {
            './passport-vc': passport
        }).strategy;
    };

    const config = {
        provider: 'vc',
        verifierHost: 'some_url',
        verifierTokenPath: '/path',
        verifierJWKSPath: '/jwksPath',
        callbackURL: 'some_uri',
        allowedRoles: ['seller', 'customer'],
        isRedirection: false,
        verifierHost: 'https://verifierhost.com'
    };
    const idpId = 'some_id';

    describe('Build Strategy', () => {
        it ('Should build passport strategy', (done) => {
            const passportMock = {
                Strategy: MockStrategy
            };

            const toTest = buildStrategyMock(passportMock);

            const builderToTest = toTest(config);
            const userStrategy = builderToTest.buildStrategy((accessToken, refreshToken, profile, _cbDone) => {
                expect(accessToken).toEqual('token');
                expect(refreshToken).toEqual('refresh');
                expect(profile).toEqual({
                    organizations: [
                        { id: idpId, name: idpId, roles: [
                            { id: 'seller', name: 'seller' },
                            { id: 'customer', name: 'customer' }
                        ] }
                    ],
                    idpId: idpId,
                    _json: {
                        email: 'user@email.com',
                        username: 'username',
                        displayName: 'display name'
                    }
                });

                let params = userStrategy.getParams();
                expect(params).toEqual({
                    verifierTokenURL: config.verifierHost + config.verifierTokenPath,
                    verifierJWKSURL: config.verifierHost + config.verifierJWKSPath,
                    redirectURI: config.callbackURL,
                    allowedRoles: config.allowedRoles,
                    clientID: config.clientID,
                    privateKey: config.privateKey,
                    isRedirection: false,
                    verifierHost: config.verifierHost
                });

                done();
            });

            userStrategy.setProfileParams(null, {
                organizations: [
                    { id: idpId, name: idpId, roles: [
                        { id: 'seller', name: 'seller' },
                        { id: 'customer', name: 'customer' }
                    ] }
                ],
                idpId: idpId,
                _json: {
                    email: 'user@email.com',
                    username: 'username',
                    displayName: 'display name'
                }
            }, 'token', 'refresh');

            userStrategy.loginComplete();
        });
    });

    describe('Get Scope', () => {
        it ('should return empty scope', () => {
            const passportMock = {
                Strategy: MockStrategy
            }

            const toTest = buildStrategyMock(passportMock);

            const builderToTest = toTest(config);
            const scope = builderToTest.getScope();
            expect(scope).toEqual(['']);
        });
    });

    describe('VC Login', () => {
        const STRATEGY_NAME = 'vc';
        const EXPIRED_ACCESS_TOKEN = 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjludzFYb1kxQ09yX21XWXd0V3loRmRzSTJQaHdVNVpwb1pGaVMyM2pXMmMiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOlsiYmVrYS1teS12Yy1iZWthLXRyLmFwcHMuZml3YXJlLmZpd2FyZS5kZXYiXSwiY2xpZW50X2lkIjoiZGlkOmtleTp6Nk1raWdDRW5vcHd1ano4VGVuMmR6cTkxbnZNanFiS1FZY2lmdVpocUJzRWtIN2ciLCJleHAiOjE2ODI2ODEwNzIsImlzcyI6ImRpZDprZXk6ejZNa2lnQ0Vub3B3dWp6OFRlbjJkenE5MW52TWpxYktRWWNpZnVaaHFCc0VrSDdnIiwia2lkIjoiOW53MVhvWTFDT3JfbVdZd3RXeWhGZHNJMlBod1U1WnBvWkZpUzIzalcyYyIsInN1YiI6ImRpZDpteTp3YWxsZXQiLCJ2ZXJpZmlhYmxlQ3JlZGVudGlhbCI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vdzNpZC5vcmcvc2VjdXJpdHkvc3VpdGVzL2p3cy0yMDIwL3YxIl0sImNyZWRlbnRpYWxTY2hlbWEiOnsiaWQiOiJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vaGVzdXNydWl6L2RzYmFtdmYvbWFpbi9zY2hlbWFzL1BhY2tldERlbGl2ZXJ5U2VydmljZS8yMDIyLTEwL3NjaGVtYS5qc29uIiwidHlwZSI6IkZ1bGxKc29uU2NoZW1hVmFsaWRhdG9yMjAyMSJ9LCJjcmVkZW50aWFsU3ViamVjdCI6eyJlbWFpbCI6Im5vcm1hbC11c2VyQGZpd2FyZS5vcmciLCJpZCI6ImRjMmY0YzliLTMxZjEtNGUwOC05MGExLTg1NjAzNGQxMDQwYSIsInJvbGVzIjpbeyJuYW1lcyI6WyJTVEFOREFSRF9DVVNUT01FUiJdLCJ0YXJnZXQiOiJkaWQ6a2V5Ono2TWtzVTZ0TWZiYUR6dmFSZTVvRkU0ZVpUVlRWNEhKTTRmbVFXV0dzREdRVnNFciJ9XX0sImV4cGlyYXRpb25EYXRlIjoiMjAyMy0wNC0zMFQyMjo1NDoxMFoiLCJpZCI6InVybjp1dWlkOjgxYzRmZDI5LTAzN2EtNGZjNS04ZjI4LWZjZDhjN2QzOTgzNCIsImlzc3VhbmNlRGF0ZSI6IjIwMjMtMDQtMjhUMTA6NTQ6MTNaIiwiaXNzdWVkIjoiMjAyMy0wNC0yOFQxMDo1NDoxM1oiLCJpc3N1ZXIiOiJkaWQ6a2V5Ono2TWtpZ0NFbm9wd3VqejhUZW4yZHpxOTFudk1qcWJLUVljaWZ1WmhxQnNFa0g3ZyIsInByb29mIjp7ImNyZWF0ZWQiOiIyMDIzLTA0LTI4VDEwOjU0OjE0WiIsImNyZWF0b3IiOiJkaWQ6a2V5Ono2TWtpZ0NFbm9wd3VqejhUZW4yZHpxOTFudk1qcWJLUVljaWZ1WmhxQnNFa0g3ZyIsImp3cyI6ImV5SmlOalFpT21aaGJITmxMQ0pqY21sMElqcGJJbUkyTkNKZExDSmhiR2NpT2lKRlpFUlRRU0o5Li5fQUNTTTcyQnFzejAxdXltZzFTcVJzRF9GeU0zejE3akFwdURDakVOY3lZU1RJS2lJX0d0MWd1d0lhUkJlS0doQ1NIZVc0WnVEOHJFcWNoSlZnMTdDZyIsInR5cGUiOiJKc29uV2ViU2lnbmF0dXJlMjAyMCIsInZlcmlmaWNhdGlvbk1ldGhvZCI6ImRpZDprZXk6ejZNa2lnQ0Vub3B3dWp6OFRlbjJkenE5MW52TWpxYktRWWNpZnVaaHFCc0VrSDdnI3o2TWtpZ0NFbm9wd3VqejhUZW4yZHpxOTFudk1qcWJLUVljaWZ1WmhxQnNFa0g3ZyJ9LCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiUGFja2V0RGVsaXZlcnlTZXJ2aWNlIl0sInZhbGlkRnJvbSI6IjIwMjMtMDQtMjhUMTA6NTQ6MTNaIn19.4vevHjoPQrbx_GtKnWjfdRY3FG0eUYthpnC39mT-T0qc_hlBLUWp-HK1KwTrmxXQqleCpmqtt3ujhjdVCAXRfg';
        const VALID_ACCESS_TOKEN = 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImU4bmRaY01hcUt1Z0kwRkxUUmZUX0xNTWM4WUI1cEt5RXZGZkVMc0VyTjgiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOlsiZG9tZS1tYXJrZXRwbGFjZS5vcmciXSwiY2xpZW50X2lkIjoiZGlkOndlYjpkb21lLW1hcmtldHBsYWNlLm9yZyIsImV4cCI6MTcwNDk3NTk5OSwiaXNzIjoiZGlkOndlYjpkb21lLW1hcmtldHBsYWNlLm9yZyIsImtpZCI6ImU4bmRaY01hcUt1Z0kwRkxUUmZUX0xNTWM4WUI1cEt5RXZGZkVMc0VyTjgiLCJzdWIiOiJkaWQ6bXk6d2FsbGV0IiwidmVyaWZpYWJsZUNyZWRlbnRpYWwiOnsiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3czaWQub3JnL3NlY3VyaXR5L3N1aXRlcy9qd3MtMjAyMC92MSJdLCJjcmVkZW50aWFsU2NoZW1hIjp7ImlkIjoiaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0ZJV0FSRS1PcHMvdGVjaC14LWNoYWxsZW5nZS9tYWluL3NjaGVtYS5qc29uIiwidHlwZSI6IkZ1bGxKc29uU2NoZW1hVmFsaWRhdG9yMjAyMSJ9LCJjcmVkZW50aWFsU3ViamVjdCI6eyJmYW1pbHlOYW1lIjoiVXNlciIsImZpcnN0TmFtZSI6IkFkbWluIiwiaWQiOiI2NGU5ZmJjNy00NGQ3LTQxMGQtYTllNS1hNDQ3MjFjNGQwYmUiLCJyb2xlcyI6W3sibmFtZXMiOlsiYWRtaW4iXSwidGFyZ2V0IjoiZGlkOndlYjpkb21lLW1hcmtldHBsYWNlLm9yZyJ9XSwidHlwZSI6Imd4Ok5hdHVyYWxQYXJ0aWNpcGFudCJ9LCJpZCI6InVybjp1dWlkOmI2MWVmNzUxLTVkZmUtNDVjOC04Y2YzLTNlMDQ1ZmY4MzMzYyIsImlzc3VhbmNlRGF0ZSI6IjIwMjQtMDEtMDlUMTA6MTI6NTRaIiwiaXNzdWVkIjoiMjAyNC0wMS0wOVQxMDoxMjo1NFoiLCJpc3N1ZXIiOiJkaWQ6d2ViOmRvbWUtbWFya2V0cGxhY2Uub3JnIiwicHJvb2YiOnsiY3JlYXRlZCI6IjIwMjQtMDEtMDlUMTA6MTI6NTRaIiwiY3JlYXRvciI6ImRpZDp3ZWI6ZG9tZS1tYXJrZXRwbGFjZS5vcmciLCJqd3MiOiJleUppTmpRaU9tWmhiSE5sTENKamNtbDBJanBiSW1JMk5DSmRMQ0poYkdjaU9pSkZaRVJUUVNKOS4udDYyU1M4Zm1jZlpKMXo2dGc1Y283Wkd3UXZSUEFjOXhkam0zVElEem40Wlp3Tk1DeG1ZSTRnWkpUeGtmdFV0cWlnTklFNHpLaVZEcDlOeEFyS2lKQ2ciLCJ0eXBlIjoiSnNvbldlYlNpZ25hdHVyZTIwMjAiLCJ2ZXJpZmljYXRpb25NZXRob2QiOiJkaWQ6d2ViOmRvbWUtbWFya2V0cGxhY2Uub3JnI2Q2NjUzY2I1Nzk0MjRjMzg5YjU2ZTFhZjYxMTEwZTAzIn0sInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJMZWdhbFBlcnNvbkNyZWRlbnRpYWwiXSwidmFsaWRGcm9tIjoiMjAyNC0wMS0wOVQxMDoxMjo1NFoifX0.CdxXp4TMH4C6Ki--jgpn-SCH0XFnX4R8vxuYos9ZaljxmlLMUjXFRVhGJfJOnGrn9UF0s1O_Xjoc4gmcpO8RHA';
        const PUBLIC_KEY_FOR_VALID_TOKEN = '-----BEGIN PUBLIC KEY-----\n' +
            'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAErJIuX0AvFSLkg/oEPvpaxu4RIUuo\n' +
            'aY1g0T+fF48saB0E5xdF4ydbD1xgvKRT2OZx4vQN13f84IczNfKHf43chQ==\n' +
            '-----END PUBLIC KEY-----';
        const ANY_STATE = 'state';
        const ANY_AUTH_CODE = 'code';
        const DUMMY_RESPONSE = {
            end: () => {}
        };
        const VALID_CONFIG = {
            allowedRoles: ['customer', 'seller', 'admin'],
            clientID: 'did:1234',
            privateKey: '123456'
        };
        const REDIRECTION_CONFIG = {
            allowedRoles: ['customer', 'seller', 'admin'],
            isRedirection: true,
            clientID: 'did:1234',
            privateKey: '123456'
        }

        let nextFunctionFor200;
        let nextFunctionFor401;
        let accessToken;

        const mockNextHandlers = (done) => {
            nextFunctionFor200 = (err = null) => {
                if (err) {
                    done.fail(err);
                } else {
                    done();
                }
            };

            nextFunctionFor401 = (err = null) => {
                if (err) {
                    done();
                } else {
                    done.fail(new Error('Authentication should have been failed.'));
                }
            };
        }

        const initPassportStrategy = (strategyConfig, cb) => {
            const strategy = proxyquire('../../../lib/strategies/vc', {
                './passport-vc': proxyquire('../../../lib/strategies/passport-vc', {
                    'node-fetch': async function (){
                        return Promise.resolve({
                            status: 200,
                            json: async () => {
                                return {
                                    access_token: accessToken
                                };
                            }
                        });
                    },
                    'jwks-rsa': () => {
                        return {
                            getSigningKey: (kid, cb) => {
                                cb(null, {
                                    getPublicKey: () => {
                                        return PUBLIC_KEY_FOR_VALID_TOKEN
                                    }
                                });
                            }
                        };
                    },
                    'jsonwebtoken': {
                        decode: (token) => {
                            return jwt.decode(token, {complete: true});
                        },
                        verify: (token, key, cb) => {
                            cb(null, jwt.decode(accessToken));
                        }
                    }
                })
            }).strategy;

            const vc = strategy(strategyConfig);
            passport.use(STRATEGY_NAME, vc.buildStrategy((accToken, refreshToken, profile, _cbDone) => {
                expect(accToken).toEqual(accessToken);
                expect(refreshToken).toEqual(accessToken);

                cb()
            }));
        };

        const initPassportStrategyNextHandler = (strategyConfig) => {
            initPassportStrategy(strategyConfig, () => {})
        }

        const initPassportStrategyVerifyCb = (strategyConfig, done) => {
            initPassportStrategy(strategyConfig, () => {
                done()
            })
        }

        const callPassportAuthenticateForCallback = () => {
            passport.authenticate(STRATEGY_NAME, { failureRedirect: '/error' })(
                {
                    query: {
                        state: ANY_STATE,
                        code: ANY_AUTH_CODE
                    }
                }, DUMMY_RESPONSE, nextFunctionFor200
            );
        };

        const callPassportAuthenticateForPolling = (next) => {
            passport.authenticate(STRATEGY_NAME, { poll: true, state: ANY_STATE })(
                {
                    session: {}
                }, DUMMY_RESPONSE, next
            );
        };

        const userScansQRCodeWithValidCertificate = () => {
            accessToken = VALID_ACCESS_TOKEN;
            callPassportAuthenticateForCallback();
        };

        const userScansQRCodeWithExpiredCertificate = () => {
            accessToken = EXPIRED_ACCESS_TOKEN;
            callPassportAuthenticateForCallback();
        };

        const userGets200AndReceivesAccessToken = () => {
            callPassportAuthenticateForPolling(nextFunctionFor200);
        };

        const userGets401 = () => {
            callPassportAuthenticateForPolling(nextFunctionFor401);
        };

        it('should authenticate user with a valid certificate', (done) => {
            mockNextHandlers(done)
            initPassportStrategyNextHandler(VALID_CONFIG);
            userScansQRCodeWithValidCertificate();
            userGets200AndReceivesAccessToken();
        });

        it('should not authenticate user with an expired certificate', (done) => {
            mockNextHandlers(done)
            initPassportStrategyNextHandler(VALID_CONFIG);
            userScansQRCodeWithExpiredCertificate();
            userGets401();
        });

        it('should authenticate user with a valid certificate using the redirection approach', (done) => {
            initPassportStrategyVerifyCb(REDIRECTION_CONFIG, done);
            userScansQRCodeWithValidCertificate()
            // No need to call the polling
        })
    });

    describe('VC types subjects', () => {
        const VerifiableCredential = require('../../../lib/strategies/passport-vc').VerifiableCredential

        it('should build a vc with a LegalPersonCredential with email', () => {
            const payload = {
                "verifiableCredential": {
                    "credentialSubject": {
                      "email": "admin@test.com",
                      "familyName": "User",
                      "firstName": "Admin",
                      "id": "64e9fbc7-44d7-410d-a9e5-a44721c4d0be",
                      "roles": [
                        {
                          "names": [
                            "admin"
                          ],
                          "target": "did:web:dome-marketplace.org"
                        }
                      ],
                      "type": "gx:NaturalParticipant"
                    },
                    "id": "urn:uuid:b61ef751-5dfe-45c8-8cf3-3e045ff8333c",
                    "issuanceDate": "2024-01-09T10:12:54Z",
                    "issued": "2024-01-09T10:12:54Z",
                    "issuer": "did:web:dome-marketplace.org",
                    "type": [
                      "VerifiableCredential",
                      "LegalPersonCredential"
                    ],
                    "validFrom": "2024-01-09T10:12:54Z"
                }
            }
            const credential = new VerifiableCredential(payload)
            const profile = credential.getProfile()

            expect(profile.id).toEqual('admin@test.com')
            expect(profile.email).toEqual('admin@test.com')
            expect(profile.username).toEqual('admin')
            expect(profile.issuerDid).toEqual('did:web:dome-marketplace.org')
            expect(profile.idpId).toEqual('did:web:dome-marketplace.org')
            expect(profile.roles).toEqual([ { id: 'admin', name: 'admin' } ])

            expect(profile.organizations).toEqual([{
                id: 'did:web:dome-marketplace.org',
                name: 'did:web:dome-marketplace.org',
                roles: [
                    { name: 'seller', id: 'seller' },
                    { name: 'customer', id: 'customer' },
                    { name: 'orgAdmin', id: 'orgAdmin' }
                ]
            }])
        })

        it('should build a vc with a LegalPersonCredential with issuer', () => {
            const payload = {
                "verifiableCredential": {
                    "credentialSubject": {
                      "familyName": "User",
                      "firstName": "Admin",
                      "id": "64e9fbc7-44d7-410d-a9e5-a44721c4d0be",
                      "roles": [
                        {
                          "names": [
                            "admin"
                          ],
                          "target": "did:web:dome-marketplace.org"
                        }
                      ],
                      "type": "gx:NaturalParticipant"
                    },
                    "id": "urn:uuid:b61ef751-5dfe-45c8-8cf3-3e045ff8333c",
                    "issuanceDate": "2024-01-09T10:12:54Z",
                    "issued": "2024-01-09T10:12:54Z",
                    "issuer": "did:web:dome-marketplace.org",
                    "type": [
                      "VerifiableCredential",
                      "LegalPersonCredential"
                    ],
                    "validFrom": "2024-01-09T10:12:54Z"
                }
            }
            const credential = new VerifiableCredential(payload)
            const profile = credential.getProfile()

            expect(profile.id).toEqual('did:web:dome-marketplace.org:individual')
            expect(profile.email).toEqual('did.web.dome-marketplace.org@email.com')
            expect(profile.username).toEqual('did.web.dome-marketplace.org')
            expect(profile.issuerDid).toEqual('did:web:dome-marketplace.org')
            expect(profile.idpId).toEqual('did:web:dome-marketplace.org')
            expect(profile.roles).toEqual([ { id: 'admin', name: 'admin' } ])

            expect(profile.organizations).toEqual([{
                id: 'did:web:dome-marketplace.org',
                name: 'did:web:dome-marketplace.org',
                roles: [
                    { name: 'seller', id: 'seller' },
                    { name: 'customer', id: 'customer' },
                    { name: 'orgAdmin', id: 'orgAdmin' }
                ]
            }])
        })

        it('should build a vc with a LEARCredential', () => {
            const payload = {
                "verifiableCredential": {
                    "id": "1f33e8dc-bd3b-4395-8061-ebc6be7d06dd",
                    "type": [
                      "VerifiableCredential",
                      "LEARCredentialEmployee"
                    ],
                    "credentialSubject": {
                      "mandate": {
                        "id": "4e3c02b8-5c57-4679-8aa5-502d62484af5",
                        "life_span": {
                          "end_date_time": "2025-04-02 09:23:22.637345122 +0000 UTC",
                          "start_date_time": "2024-04-02 09:23:22.637345122 +0000 UTC"
                        },
                        "mandatee": {
                          "id": "did:key:zDnaeei6HxVe7ibR123456789",
                          "email": "admin@email.com",
                          "first_name": "Admin",
                          "gender": "M",
                          "last_name": "User",
                          "mobile_phone": "+34666111222"
                        },
                        "mandator": {
                          "commonName": "TEST",
                          "country": "ES",
                          "emailAddress": "test@test.com",
                          "organization": "TestCompany, S.L.",
                          "organizationIdentifier": "VATES-C12341234",
                          "serialNumber": "C12341234"
                        },
                        "power": [
                          {
                            "id": "6b8f3137-a57a-46a5-97e7-1117a20142fb",
                            "tmf_action": "Execute",
                            "tmf_domain": "DOME",
                            "tmf_function": "Onboarding",
                            "tmf_type": "Domain"
                          },
                          {
                            "id": "ad9b1509-60ea-47d4-9878-18b581d8e19b",
                            "tmf_action": [
                              "Create",
                              "Update"
                            ],
                            "tmf_domain": "DOME",
                            "tmf_function": "ProductOffering",
                            "tmf_type": "Domain"
                          }
                        ]
                      },
                      "roles": []
                    },
                    "expirationDate": "2025-04-02 09:23:22.637345122 +0000 UTC",
                    "issuanceDate": "2024-04-02 09:23:22.637345122 +0000 UTC",
                    "issuer": "did:web:test.es",
                    "validFrom": "2024-04-02 09:23:22.637345122 +0000 UTC"
                }
            }

            const credential = new VerifiableCredential(payload)
            const profile = credential.getProfile()

            expect(profile.id).toEqual('did:key:zDnaeei6HxVe7ibR123456789')
            expect(profile.email).toEqual('admin@email.com')
            expect(profile.username).toEqual('admin')
            expect(profile.issuerDid).toEqual('did:web:test.es')
            expect(profile.idpId).toEqual('did:web:test.es')
            expect(profile.roles).toEqual([])

            expect(profile.organizations).toEqual([{
                id: 'VATES-C12341234',
                name: 'TestCompany, S.L.',
                roles: [
                    { name: 'orgAdmin', id: 'orgAdmin' },
                    { name: 'seller', id: 'seller' }
                ]
            }])
        })

        it('should build a vc with a LEARCredential in VerifiablePresentation', () => {
            const payload = {
                "verifiablePresentation": [{
                    "type": [
                      "VerifiableCredential",
                      "LegalPersonCredential"
                    ]
                }, {
                    "id": "1f33e8dc-bd3b-4395-8061-ebc6be7d06dd",
                    "type": [
                      "VerifiableCredential",
                      "LEARCredentialEmployee"
                    ],
                    "credentialSubject": {
                      "mandate": {
                        "id": "4e3c02b8-5c57-4679-8aa5-502d62484af5",
                        "life_span": {
                          "end_date_time": "2025-04-02 09:23:22.637345122 +0000 UTC",
                          "start_date_time": "2024-04-02 09:23:22.637345122 +0000 UTC"
                        },
                        "mandatee": {
                          "id": "did:key:zDnaeei6HxVe7ibR123456789",
                          "email": "admin@email.com",
                          "first_name": "Admin",
                          "gender": "M",
                          "last_name": "User",
                          "mobile_phone": "+34666111222"
                        },
                        "mandator": {
                          "commonName": "TEST",
                          "country": "ES",
                          "emailAddress": "test@test.com",
                          "organization": "TestCompany, S.L.",
                          "organizationIdentifier": "VATES-C12341234",
                          "serialNumber": "C12341234"
                        },
                        "power": [
                          {
                            "id": "6b8f3137-a57a-46a5-97e7-1117a20142fb",
                            "tmf_action": "Execute",
                            "tmf_domain": "DOME",
                            "tmf_function": "Onboarding",
                            "tmf_type": "Domain"
                          },
                          {
                            "id": "ad9b1509-60ea-47d4-9878-18b581d8e19b",
                            "tmf_action": [
                              "Create",
                              "Update"
                            ],
                            "tmf_domain": "DOME",
                            "tmf_function": "ProductOffering",
                            "tmf_type": "Domain"
                          }
                        ]
                      },
                      "roles": []
                    },
                    "expirationDate": "2025-04-02 09:23:22.637345122 +0000 UTC",
                    "issuanceDate": "2024-04-02 09:23:22.637345122 +0000 UTC",
                    "issuer": "did:web:test.es",
                    "validFrom": "2024-04-02 09:23:22.637345122 +0000 UTC"
                }]
            }

            const credential = new VerifiableCredential(payload)
            const profile = credential.getProfile()

            expect(profile.id).toEqual('did:key:zDnaeei6HxVe7ibR123456789')
            expect(profile.email).toEqual('admin@email.com')
            expect(profile.username).toEqual('admin')
            expect(profile.issuerDid).toEqual('did:web:test.es')
            expect(profile.idpId).toEqual('did:web:test.es')
            expect(profile.roles).toEqual([])

            expect(profile.organizations).toEqual([{
                id: 'VATES-C12341234',
                name: 'TestCompany, S.L.',
                roles: [
                    { name: 'orgAdmin', id: 'orgAdmin' },
                    { name: 'seller', id: 'seller' }
                ]
            }])
        })

        it ('should build a VC with a LEARCredential including certifier power', () => {
            const payload = {
                "verifiableCredential": {
                    "id": "1f33e8dc-bd3b-4395-8061-ebc6be7d06dd",
                    "type": [
                      "VerifiableCredential",
                      "LEARCredentialEmployee"
                    ],
                    "credentialSubject": {
                      "mandate": {
                        "id": "4e3c02b8-5c57-4679-8aa5-502d62484af5",
                        "life_span": {
                          "end_date_time": "2025-04-02 09:23:22.637345122 +0000 UTC",
                          "start_date_time": "2024-04-02 09:23:22.637345122 +0000 UTC"
                        },
                        "mandatee": {
                          "id": "did:key:zDnaeei6HxVe7ibR123456789",
                          "email": "admin@email.com",
                          "first_name": "Admin",
                          "gender": "M",
                          "last_name": "User",
                          "mobile_phone": "+34666111222"
                        },
                        "mandator": {
                          "commonName": "TEST",
                          "country": "ES",
                          "emailAddress": "test@test.com",
                          "organization": "TestCompany, S.L.",
                          "organizationIdentifier": "VATES-C12341234",
                          "serialNumber": "C12341234"
                        },
                        "power": [
                          {
                            "id": "6b8f3137-a57a-46a5-97e7-1117a20142fb",
                            "tmf_action": "Execute",
                            "tmf_domain": "DOME",
                            "tmf_function": "Onboarding",
                            "tmf_type": "Domain"
                          },
                          {
                            "id": "ad9b1509-60ea-47d4-9878-18b581d8e19b",
                            "tmf_action": [
                              "UploadCertificate"
                            ],
                            "tmf_domain": "DOME",
                            "tmf_function": "Certification",
                            "tmf_type": "Domain"
                          }
                        ]
                      },
                      "roles": []
                    },
                    "expirationDate": "2025-04-02 09:23:22.637345122 +0000 UTC",
                    "issuanceDate": "2024-04-02 09:23:22.637345122 +0000 UTC",
                    "issuer": "did:web:test.es",
                    "validFrom": "2024-04-02 09:23:22.637345122 +0000 UTC"
                }
            }

            const credential = new VerifiableCredential(payload)
            const profile = credential.getProfile()

            expect(profile.organizations).toEqual([{
                id: 'VATES-C12341234',
                name: 'TestCompany, S.L.',
                roles: [
                    { name: 'orgAdmin', id: 'orgAdmin' },
                    { name: 'certifier', id: 'certifier' }
                ]
            }])
        })

        it ('should build a VC with a LEARCredentialMachine including certifier power', () => {
            const payload = {
                "verifiableCredential": {
                    "id": "1f33e8dc-bd3b-4395-8061-ebc6be7d06dd",
                    "type": [
                      "VerifiableCredential",
                      "LEARCredentialMachine"
                    ],
                    "credentialSubject": {
                      "mandate": {
                        "id": "4e3c02b8-5c57-4679-8aa5-502d62484af5",
                        "life_span": {
                          "end_date_time": "2025-04-02 09:23:22.637345122 +0000 UTC",
                          "start_date_time": "2024-04-02 09:23:22.637345122 +0000 UTC"
                        },
                        "mandatee": {
                          "id": "did:key:zDnaeei6HxVe7ibR123456789",
                          "email": "admin@email.com",
                          "first_name": "Admin",
                          "gender": "M",
                          "last_name": "User",
                          "mobile_phone": "+34666111222"
                        },
                        "mandator": {
                          "commonName": "TEST",
                          "country": "ES",
                          "emailAddress": "test@test.com",
                          "organization": "TestCompany, S.L.",
                          "organizationIdentifier": "VATES-C12341234",
                          "serialNumber": "C12341234"
                        },
                        "power": [
                            {
                                "id": "ad9b1509-60ea-47d4-9878-18b581d8e19b",
                                "action": [
                                  "Create",
                                  "Update"
                                ],
                                "domain": "DOME",
                                "function": "ProductOffering",
                                "type": "Domain"
                            },
                            {
                                "id": "6b8f3137-a57a-46a5-97e7-1117a20142fb",
                                "action": "Execute",
                                "domain": "DOME",
                                "function": "Onboarding",
                                "type": "Domain"
                            },
                            {
                                "id": "ad9b1509-60ea-47d4-9878-18b581d8e19b",
                                "action": "post_verifiable_certification",
                                "domain": "DOME",
                                "function": "Certification",
                                "type": "Domain"
                            }
                        ]
                      },
                      "roles": []
                    },
                    "expirationDate": "2025-04-02 09:23:22.637345122 +0000 UTC",
                    "issuanceDate": "2024-04-02 09:23:22.637345122 +0000 UTC",
                    "issuer": "did:web:test.es",
                    "validFrom": "2024-04-02 09:23:22.637345122 +0000 UTC"
                }
            }

            const credential = new VerifiableCredential(payload)
            const profile = credential.getProfile()

            expect(profile.organizations).toEqual([{
                id: 'VATES-C12341234',
                name: 'TestCompany, S.L.',
                roles: [
                    { name: 'seller', id: 'seller' },
                    { name: 'orgAdmin', id: 'orgAdmin' },
                    { name: 'certifier', id: 'certifier' },
                ]
            }])
        })
    })
});