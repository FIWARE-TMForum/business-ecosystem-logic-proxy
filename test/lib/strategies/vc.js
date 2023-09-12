
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
        allowedRoles: ['seller', 'customer']
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
                    allowedRoles: config.allowedRoles
                });

                done();
            });

            userStrategy.setProfileParams(null, {
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
        const VALID_ACCESS_TOKEN = 'eyJhbGciOiJFUzI1NiIsImtpZCI6IlY3WktjRWwtcDhhaHp1WHNuU29CM1Z1ampTVWNCZVJLaTF1SXdzLTVRMUkiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOlsiYmVrYS1teS12Yy1iZWthLXRyLmFwcHMuZml3YXJlLmZpd2FyZS5kZXYiXSwiY2xpZW50X2lkIjoiZGlkOmtleTp6Nk1raWdDRW5vcHd1ano4VGVuMmR6cTkxbnZNanFiS1FZY2lmdVpocUJzRWtIN2ciLCJleHAiOjE2ODU3MTI2ODgsImlzcyI6ImRpZDprZXk6ejZNa2lnQ0Vub3B3dWp6OFRlbjJkenE5MW52TWpxYktRWWNpZnVaaHFCc0VrSDdnIiwia2lkIjoiVjdaS2NFbC1wOGFoenVYc25Tb0IzVnVqalNVY0JlUktpMXVJd3MtNVExSSIsInN1YiI6ImRpZDpteTp3YWxsZXQiLCJ2ZXJpZmlhYmxlQ3JlZGVudGlhbCI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vdzNpZC5vcmcvc2VjdXJpdHkvc3VpdGVzL2p3cy0yMDIwL3YxIl0sImNyZWRlbnRpYWxTY2hlbWEiOnsiaWQiOiJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vaGVzdXNydWl6L2RzYmFtdmYvbWFpbi9zY2hlbWFzL1BhY2tldERlbGl2ZXJ5U2VydmljZS8yMDIyLTEwL3NjaGVtYS5qc29uIiwidHlwZSI6IkZ1bGxKc29uU2NoZW1hVmFsaWRhdG9yMjAyMSJ9LCJjcmVkZW50aWFsU3ViamVjdCI6eyJlbWFpbCI6InByZW1pdW0tdXNlckBmaXdhcmUub3JnIiwiZmFtaWx5TmFtZSI6IlVzZXIiLCJmaXJzdE5hbWUiOiJQcmVtaXVtIiwiaWQiOiJjNDE1OTJjOC0wNzgzLTRjZjItYmM1Zi05NWU3ZTQ2YmE0NWQiLCJyb2xlcyI6W3sibmFtZXMiOlsic2VsbGVyIl0sInRhcmdldCI6ImRpZDprZXk6ejZNa3NVNnRNZmJhRHp2YVJlNW9GRTRlWlRWVFY0SEpNNGZtUVdXR3NER1FWc0VyIn1dfSwiZXhwaXJhdGlvbkRhdGUiOiIyMDk5LTA2LTIxVDA1OjE3OjQxWiIsImlkIjoidXJuOnV1aWQ6MWY1NzdkOTUtNDNlYi00MjMyLWI2NDctZTAwNGMxMjNmOTk0IiwiaXNzdWFuY2VEYXRlIjoiMjAyMy0wNi0wMlQxMDozNzo0MVoiLCJpc3N1ZWQiOiIyMDIzLTA2LTAyVDEwOjM3OjQxWiIsImlzc3VlciI6ImRpZDprZXk6ejZNa2lnQ0Vub3B3dWp6OFRlbjJkenE5MW52TWpxYktRWWNpZnVaaHFCc0VrSDdnIiwicHJvb2YiOnsiY3JlYXRlZCI6IjIwMjMtMDYtMDJUMTA6Mzc6NDFaIiwiY3JlYXRvciI6ImRpZDprZXk6ejZNa2lnQ0Vub3B3dWp6OFRlbjJkenE5MW52TWpxYktRWWNpZnVaaHFCc0VrSDdnIiwiandzIjoiZXlKaU5qUWlPbVpoYkhObExDSmpjbWwwSWpwYkltSTJOQ0pkTENKaGJHY2lPaUpGWkVSVFFTSjkuLklrUnY5QnhxRkVjaFNoQ2Nxc19QYWFCR3JIME1ubmw5TXFpZzNkemVlSjgzN3Utc0g2QVlLWTYtVllPdkc1OEpHQnFnU0V4MVhMSThxTF9PeFU3c0JnIiwidHlwZSI6Ikpzb25XZWJTaWduYXR1cmUyMDIwIiwidmVyaWZpY2F0aW9uTWV0aG9kIjoiZGlkOmtleTp6Nk1raWdDRW5vcHd1ano4VGVuMmR6cTkxbnZNanFiS1FZY2lmdVpocUJzRWtIN2cjejZNa2lnQ0Vub3B3dWp6OFRlbjJkenE5MW52TWpxYktRWWNpZnVaaHFCc0VrSDdnIn0sInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJNYXJrZXRwbGFjZVVzZXJDcmVkZW50aWFsIl0sInZhbGlkRnJvbSI6IjIwMjMtMDYtMDJUMTA6Mzc6NDFaIn19.ng677A_1r9CbWHx2u15P8GQ4qbOkSjbGzrVMWlcS_DaV92FSh5flu9nDoAvV1fikRaPyABUsLp64BaBR_sA23A';
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
            allowedRoles: ['customer', 'seller']
        };
        let nextFunctionFor200;
        let nextFunctionFor401;
        let accessToken;

        const initPassportStrategy = (done) => {
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
                            return jwt.decode(token);
                        },
                        verify: (token, key, cb) => {
                            cb(null, jwt.decode(accessToken));
                        }
                    }
                })
            }).strategy;

            const vc = strategy(VALID_CONFIG);
            passport.use(STRATEGY_NAME, vc.buildStrategy((accToken, refreshToken, profile, _cbDone) => {
                expect(accToken).toEqual(accessToken);
                expect(refreshToken).toEqual(accessToken);
            }));
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
        };

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
            callPassportAuthenticateForCallback();
            accessToken = VALID_ACCESS_TOKEN;
        };

        const userScansQRCodeWithExpiredCertificate = () => {
            callPassportAuthenticateForCallback();
            accessToken = EXPIRED_ACCESS_TOKEN;
        };

        const userGets200AndReceivesAccessToken = () => {
            callPassportAuthenticateForPolling(nextFunctionFor200);
        };

        const userGets401 = () => {
            callPassportAuthenticateForPolling(nextFunctionFor401);
        };

        it('should authenticate user with a valid certificate', (done) => {
            initPassportStrategy(done);

            userScansQRCodeWithValidCertificate();

            userGets200AndReceivesAccessToken();
        });

        it('should not authenticate user with an expired certificate', (done) => {
            initPassportStrategy(done);

            userScansQRCodeWithExpiredCertificate();

            userGets401();
        });
    });
});