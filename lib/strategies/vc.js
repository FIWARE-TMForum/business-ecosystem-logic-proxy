const VCStrategy = require('./passport-vc').Strategy;
const jwt = require('jsonwebtoken');
const EC = require('elliptic').ec;
const crypto = require('crypto');

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
            privateKey: config.privateKey
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

    const keyObject = config.privateKeyPem
        ? _getKeyObjectFromPemPrivKey(config.privateKeyPem)
        : _getKeyObjectFromHexPrivKey(config.privateKey);

    return jwt.sign(tokenInfo, keyObject, {
        keyid: config.clientID,
        algorithm: 'ES256'
    });
}

function _getKeyObjectFromPemPrivKey(privKeyPem) {
    return crypto.createPrivateKey({
        key: privKeyPem,
        format: 'pem'
    });
}
function _getKeyObjectFromHexPrivKey(privKeyHex) {
    const ec = new EC('p256'); // P-256 curve (also known as secp256r1)
    const key = ec.keyFromPrivate(privKeyHex);

    // Get the public key in uncompressed format (includes both x and y coordinates)
    const publicKey = key.getPublic();

    // Extract x and y coordinates and encode them in Base64url format
    const x = publicKey.getX().toString('hex'); // Hex representation of x
    const y = publicKey.getY().toString('hex'); // Hex representation of y

    const jwk = {
        kty: 'EC',
        crv: 'P-256',
        d: Buffer.from(privKeyHex, 'hex').toString('base64url'),
        x: Buffer.from(x, 'hex').toString('base64url'),
        y: Buffer.from(y, 'hex').toString('base64url')
    };

    return crypto.createPrivateKey({ format: 'jwk', key: jwk });
}

exports.strategy = strategy;
exports.buildRequestJWT = buildRequestJWT;
