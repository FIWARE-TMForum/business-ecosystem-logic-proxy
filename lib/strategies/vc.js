const VCStrategy = require('./passport-vc').Strategy;
const jwtSigner = require('../jwtSigner')

function strategy(config) {
    function buildStrategy(callback) {
        const params = {
            verifierHost: config.verifierHost,
            verifierTokenURL: config.verifierHost + config.verifierTokenPath,
            verifierJWKSURL: config.verifierHost + config.verifierJWKSPath,
            redirectURI: config.callbackURL,
            allowedRoles: config.allowedRoles,
            isRedirection: config.isRedirection,
            clientID: config.clientID,
            privateKey: config.privateKey,
            signAlgorithm: config.signAlgorithm
        };

        return new VCStrategy(params, (accessToken, refreshToken, profile, done) => {
            console.log('======= _verify method ==========');
            callback(accessToken, refreshToken, profile, done);
        });
    }

    const getScope = () => {
        return [''];
    };

    return {
        buildStrategy: buildStrategy,
        getScope: getScope
    };
}

function buildRequestJWT(config) {
    console.log(config);

    const tokenInfo = {
        iss: config.clientID,
        aud: config.verifierHost,
        response_type: 'code',
        client_id: config.clientID,
        redirect_uri: config.callbackURL,
        scope: 'openid learcredential'
    };

    return jwtSigner.signJwt(tokenInfo, {
        keyid: config.clientID,
        algorithm: config.signAlgorithm
    });
}
exports.strategy = strategy;
exports.buildRequestJWT = buildRequestJWT;
