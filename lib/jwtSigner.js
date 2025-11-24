const jwt = require('jsonwebtoken');
const EC = require('elliptic').ec;
const crypto = require('crypto');
const fs = require('fs')
const config = require('../config').siop;
let keyObject;

function signJwt(tokenInfo, options) {
    if (!keyObject) {
        keyObject = config.privateKeyPem
            ? _getKeyObjectFromPemPrivKey(config.privateKeyPem)
            : _getKeyObjectFromHexPrivKey(config.privateKey);
    }

    return jwt.sign(tokenInfo, keyObject, options);
}


function _getKeyObjectFromPemPrivKey(privKeyPem) {
    try {
        const pem = fs.readFileSync(privKeyPem, 'utf-8')
        return crypto.createPrivateKey({
            key: pem,
            format: 'pem'
        });
    } catch(err) {
        console.error("Unable to read pem certificate", err);
    }
}

function _getKeyObjectFromHexPrivKey(privKeyHex) {
    const ec = new EC('p256'); // P-256 curve (also known as secp256r1)
    const key = ec.keyFromPrivate(privKeyHex);

    // Get the public key in uncompressed format (includes both x and y coordinates)
    const publicKey = key.getPublic();

    // Extract x and y coordinates and encode them in Base64url format
    const x = publicKey.getX().toString('hex').padStart(64, '0');
    const y = publicKey.getY().toString('hex').padStart(64, '0');

    const jwk = {
        kty: 'EC',
        crv: 'P-256',
        d: Buffer.from(privKeyHex, 'hex').toString('base64url').padStart(43, '0'),
        x: Buffer.from(x, 'hex').toString('base64url'),
        y: Buffer.from(y, 'hex').toString('base64url')
    };

    return crypto.createPrivateKey({ format: 'jwk', key: jwk });
}

exports.signJwt = signJwt;