const VCStrategy = require('./passport-vc').Strategy;
const jwt = require('jsonwebtoken');

function strategy(config) {

    function buildStrategy(callback) {
        const params = {
            verifierTokenURL: config.verifierHost + config.verifierTokenPath,
            verifierJWKSURL: config.verifierHost + config.verifierJWKSPath,
            redirectURI: config.callbackURL,
            allowedRoles: config.allowedRoles,
            isRedirection: config.isRedirection,
            clientID: config.clientID,
            privateKey: config.privateKey
        };

        return new VCStrategy(params, (accessToken, refreshToken, profile, done) => {
            console.log('======= _verify method ==========')
            callback(accessToken, refreshToken, profile, done);
        });
    }

    const getScope = () => {
        return [''];
    };

    return {
        buildStrategy: buildStrategy,
        getScope: getScope
    }
}

function buildRequestJWT(config) {
    console.log(config)

    const tokenInfo = {
        "iss": config.clientID,
        "aud": config.verifierHost,
        "response_type": "code",
        "client_id": config.clientID,
        "redirect_uri": config.callbackURL,
        "scope": "openid learcred",
    }

    return jwt.sign(tokenInfo, config.privateKey, {
        keyid: config.clientID
    });
}

exports.strategy = strategy;
exports.buildRequestJWT = buildRequestJWT;