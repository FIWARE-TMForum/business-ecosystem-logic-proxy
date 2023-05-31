
const proxyquire = require('proxyquire');
const passport = require('passport');
const MockStrategy = require('../../utils').MockStrategy;

describe('VC Strategy', () => {
    const buildStrategyMock = (passport) => {
        return proxyquire('../../../lib/strategies/vc', {
            './passport-vc': passport
        }).strategy;
    };

    const config = {
        provider: 'vc',
        server: 'some_url',
        verifierTokenPath: '/path',
        callbackURL: 'some_uri',
        roles: {
            seller: 'seller',
            customer: 'customer',
            orgAdmin: 'orgAdmin'
        }
    };

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
                        { id: 'vc', name: 'vc', roles: [
                                { id: 'seller', name: 'seller' },
                                { id: 'customer', name: 'customer' },
                                { id: 'orgAdmin', name: 'orgAdmin' }
                            ] }
                    ],
                    _json: {
                        email: 'user@email.com',
                        username: 'username',
                        displayName: 'display name'
                    }
                });

                let params = userStrategy.getParams();
                expect(params).toEqual({
                    verifierTokenURL: config.server + config.verifierTokenPath,
                    redirectURI: config.callbackURL,
                    credentialType: config.credentialType
                });

                done();
            });

            userStrategy.setProfileParams(null, {
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
        const VALID_ACCESS_TOKEN = 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjludzFYb1kxQ09yX21XWXd0V3loRmRzSTJQaHdVNVpwb1pGaVMyM2pXMmMiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOlsiYmFlNC1iaXotZWNvc3lzdGVtLWxvZ2ljLXByb3h5LTAtYmVrYS10LW0yLmFwcHMuZml3YXJlLmZpd2FyZS5kZXYiXSwiY2xpZW50X2lkIjoiZGlkOmtleTp6Nk1raWdDRW5vcHd1ano4VGVuMmR6cTkxbnZNanFiS1FZY2lmdVpocUJzRWtIN2ciLCJleHAiOjE2ODQ4NTM0NDUsImlzcyI6ImRpZDprZXk6ejZNa2lnQ0Vub3B3dWp6OFRlbjJkenE5MW52TWpxYktRWWNpZnVaaHFCc0VrSDdnIiwia2lkIjoiOW53MVhvWTFDT3JfbVdZd3RXeWhGZHNJMlBod1U1WnBvWkZpUzIzalcyYyIsInN1YiI6ImRpZDpteTp3YWxsZXQiLCJ2ZXJpZmlhYmxlQ3JlZGVudGlhbCI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vdzNpZC5vcmcvc2VjdXJpdHkvc3VpdGVzL2p3cy0yMDIwL3YxIl0sImNyZWRlbnRpYWxTY2hlbWEiOnsiaWQiOiJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vaGVzdXNydWl6L2RzYmFtdmYvbWFpbi9zY2hlbWFzL1BhY2tldERlbGl2ZXJ5U2VydmljZS8yMDIyLTEwL3NjaGVtYS5qc29uIiwidHlwZSI6IkZ1bGxKc29uU2NoZW1hVmFsaWRhdG9yMjAyMSJ9LCJjcmVkZW50aWFsU3ViamVjdCI6eyJlbWFpbCI6Im5vcm1hbC11c2VyQGZpd2FyZS5vcmciLCJmYW1pbHlOYW1lIjoiVXNlciIsImZpcnN0TmFtZSI6Ik5vcm1hbCIsImlkIjoiZDdlNDgwOTctODE4MC00YjI3LWI4YTYtMmU0YjQwOWQyMzYwIiwicm9sZXMiOlt7Im5hbWVzIjpbIlNUQU5EQVJEX0NVU1RPTUVSIl0sInRhcmdldCI6ImRpZDprZXk6ejZNa3NVNnRNZmJhRHp2YVJlNW9GRTRlWlRWVFY0SEpNNGZtUVdXR3NER1FWc0VyIn1dfSwiZXhwaXJhdGlvbkRhdGUiOiIyMDk5LTA2LTExVDA5OjAwOjE3WiIsImlkIjoidXJuOnV1aWQ6ZjhmZmY2ZmUtZTk5ZC00ZTViLTg3NDEtOGFmMDk5NTA4ZGJlIiwiaXNzdWFuY2VEYXRlIjoiMjAyMy0wNS0yM1QxNDoyMDoxOFoiLCJpc3N1ZWQiOiIyMDIzLTA1LTIzVDE0OjIwOjE4WiIsImlzc3VlciI6ImRpZDprZXk6ejZNa2lnQ0Vub3B3dWp6OFRlbjJkenE5MW52TWpxYktRWWNpZnVaaHFCc0VrSDdnIiwicHJvb2YiOnsiY3JlYXRlZCI6IjIwMjMtMDUtMjNUMTQ6MjA6MThaIiwiY3JlYXRvciI6ImRpZDprZXk6ejZNa2lnQ0Vub3B3dWp6OFRlbjJkenE5MW52TWpxYktRWWNpZnVaaHFCc0VrSDdnIiwiandzIjoiZXlKaU5qUWlPbVpoYkhObExDSmpjbWwwSWpwYkltSTJOQ0pkTENKaGJHY2lPaUpGWkVSVFFTSjkuLktiTmF6VE9RUmJ5VDAyU3YzZ3RhelQ3NFhSQmR2VVE5dDdtUDdlaVVyYnA2akpWN2hiVThOUkhodTVlOGNyT1BIMzdOMTlveUdQWW1WWnEwTWhvNUJ3IiwidHlwZSI6Ikpzb25XZWJTaWduYXR1cmUyMDIwIiwidmVyaWZpY2F0aW9uTWV0aG9kIjoiZGlkOmtleTp6Nk1raWdDRW5vcHd1ano4VGVuMmR6cTkxbnZNanFiS1FZY2lmdVpocUJzRWtIN2cjejZNa2lnQ0Vub3B3dWp6OFRlbjJkenE5MW52TWpxYktRWWNpZnVaaHFCc0VrSDdnIn0sInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJQYWNrZXREZWxpdmVyeVNlcnZpY2UiXSwidmFsaWRGcm9tIjoiMjAyMy0wNS0yM1QxNDoyMDoxOFoifX0.-6sS4jn9lsd_TF762oVfB1NlpqweuRQfUbD3YUTTzcU3uuZ_n0mCGJYO07Xd2GMgU_wuY3o5xPucrEABdNfStg';
        // const aa = 'eyJhbGciOiJFUzI1NiIsImtpZCI6IjludzFYb1kxQ09yX21XWXd0V3loRmRzSTJQaHdVNVpwb1pGaVMyM2pXMmMiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOlsiYmFlNC1iaXotZWNvc3lzdGVtLWxvZ2ljLXByb3h5LTAtYmVrYS10LW0yLmFwcHMuZml3YXJlLmZpd2FyZS5kZXYiXSwiY2xpZW50X2lkIjoiZGlkOmtleTp6Nk1raWdDRW5vcHd1ano4VGVuMmR6cTkxbnZNanFiS1FZY2lmdVpocUJzRWtIN2ciLCJleHAiOjE2ODQ5MzQwMDAsImlzcyI6ImRpZDprZXk6ejZNa2lnQ0Vub3B3dWp6OFRlbjJkenE5MW52TWpxYktRWWNpZnVaaHFCc0VrSDdnIiwia2lkIjoiOW53MVhvWTFDT3JfbVdZd3RXeWhGZHNJMlBod1U1WnBvWkZpUzIzalcyYyIsInN1YiI6ImRpZDpteTp3YWxsZXQiLCJ2ZXJpZmlhYmxlQ3JlZGVudGlhbCI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSIsImh0dHBzOi8vdzNpZC5vcmcvc2VjdXJpdHkvc3VpdGVzL2p3cy0yMDIwL3YxIl0sImNyZWRlbnRpYWxTY2hlbWEiOnsiaWQiOiJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vaGVzdXNydWl6L2RzYmFtdmYvbWFpbi9zY2hlbWFzL1BhY2tldERlbGl2ZXJ5U2VydmljZS8yMDIyLTEwL3NjaGVtYS5qc29uIiwidHlwZSI6IkZ1bGxKc29uU2NoZW1hVmFsaWRhdG9yMjAyMSJ9LCJjcmVkZW50aWFsU3ViamVjdCI6eyJlbWFpbCI6Im5vcm1hbC11c2VyQGZpd2FyZS5vcmciLCJmYW1pbHlOYW1lIjoiVXNlciIsImZpcnN0TmFtZSI6Ik5vcm1hbCIsImlkIjoiNjhmY2IyOWMtYzhkZi00ZWJlLWJmZWEtZDE0MDNiZTAyNGFkIiwicm9sZXMiOlt7Im5hbWVzIjpbImN1c3RvbWVyIl0sInRhcmdldCI6ImRpZDprZXk6ejZNa3NVNnRNZmJhRHp2YVJlNW9GRTRlWlRWVFY0SEpNNGZtUVdXR3NER1FWc0VyIn1dfSwiZXhwaXJhdGlvbkRhdGUiOiIyMDk5LTA2LTEyVDA3OjIxOjI2WiIsImlkIjoidXJuOnV1aWQ6ZDgxNzNkMGUtMWI0MS00OTEzLWE3OGYtMWIyMmYzODQyM2RkIiwiaXNzdWFuY2VEYXRlIjoiMjAyMy0wNS0yNFQxMjo0MToyN1oiLCJpc3N1ZWQiOiIyMDIzLTA1LTI0VDEyOjQxOjI3WiIsImlzc3VlciI6ImRpZDprZXk6ejZNa2lnQ0Vub3B3dWp6OFRlbjJkenE5MW52TWpxYktRWWNpZnVaaHFCc0VrSDdnIiwicHJvb2YiOnsiY3JlYXRlZCI6IjIwMjMtMDUtMjRUMTI6NDE6MjdaIiwiY3JlYXRvciI6ImRpZDprZXk6ejZNa2lnQ0Vub3B3dWp6OFRlbjJkenE5MW52TWpxYktRWWNpZnVaaHFCc0VrSDdnIiwiandzIjoiZXlKaU5qUWlPbVpoYkhObExDSmpjbWwwSWpwYkltSTJOQ0pkTENKaGJHY2lPaUpGWkVSVFFTSjkuLmxCWDUxWk9zSlc5WFNSQzNpeGR2T3dGcjlrbDFLc3cydFNlVXdKcGExOUpuN2hXWExBSXc5Nk1qWGxsSW1TNzRydXhsTU9zV3pKUlVtbUhKRTJhMkN3IiwidHlwZSI6Ikpzb25XZWJTaWduYXR1cmUyMDIwIiwidmVyaWZpY2F0aW9uTWV0aG9kIjoiZGlkOmtleTp6Nk1raWdDRW5vcHd1ano4VGVuMmR6cTkxbnZNanFiS1FZY2lmdVpocUJzRWtIN2cjejZNa2lnQ0Vub3B3dWp6OFRlbjJkenE5MW52TWpxYktRWWNpZnVaaHFCc0VrSDdnIn0sInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJNYXJrZXRwbGFjZVVzZXJDcmVkZW50aWFsIl0sInZhbGlkRnJvbSI6IjIwMjMtMDUtMjRUMTI6NDE6MjdaIn19.S71pDgzTOu2YRb_A8r4H6poW9IwtfsvV-RT02g7nwZNGoIDeUotMcFckKYn1Sk2LhPOBPB-fayuSqjvEnpz0aQ';
        const ANY_STATE = 'state';
        const ANY_AUTH_CODE = 'code';
        const DUMMY_RESPONSE = {
            end: () => {}
        };
        const VALID_CONFIG = {
            credentialType: ['VerifiableCredential', 'MarketplaceUserCredential'],
            roles: {
                admin: 'admin',
                customer: 'customer',
                seller: 'seller',
                orgAdmin: 'orgAdmin'
            }
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