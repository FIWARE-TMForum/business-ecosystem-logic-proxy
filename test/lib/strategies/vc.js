
const proxyquire = require('proxyquire');
const MockStrategy = require('../../utils').MockStrategy;

describe('VC Strategy', () => {
    const buildStrategyMock = (passport) => {
        return proxyquire('../../../lib/strategies/vc', {
            './passport-vc': passport
        }).strategy;
    };

    const config = {
        server: 'some_url',
        verifierTokenPath: '/path',
        roles: {
            seller: 'seller'
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
                    email: 'user@email.com',
                    username: 'username',
                    displayName: 'display name',
                    organizations: [],
                    roles: [{
                        'name': 'seller',
                        'id': 'seller'
                    }],
                    _json: {
                        email: 'user@email.com',
                        username: 'username',
                        displayName: 'display name'
                    }
                });

                let params = userStrategy.getParams();
                expect(params).toEqual({
                    verifierTokenURL: 'some_url'
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
});