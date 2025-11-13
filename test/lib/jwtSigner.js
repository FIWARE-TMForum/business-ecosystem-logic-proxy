const proxyquire = require('proxyquire');
const EC = require('elliptic').ec;
const crypto = require('crypto')
const jwt = require('jsonwebtoken');
const fs = require('fs')
const os = require('os')
const path = require('path');

describe('JWT signer', () => {
    let signer;
    let config;
    let modulePath = '../../lib/jwtSigner'

    beforeEach(() => {
        signer = proxyquire(modulePath, {
            '../config': config
        })
    })

    describe('HEX private key', () => {
        let publicKey;

        beforeAll(() => {
            const ec = new EC('p256');
            const key = ec.genKeyPair();
            const privateKey = key.getPrivate('hex');
            publicKey = key.getPublic();
            config = {
                siop: {
                    privateKey,
                    signAlgorithm: 'ES256'
                }
            }
        });
        it('should sign a valid JWT using a hex private key from config', () => {
            const payload = { sub: 'user123', iss: 'test' };
            const options = { algorithm: 'ES256', expiresIn: '1h' };

            const token = signer.signJwt(payload, options);

            // Split and check JWT structure
            const parts = token.split('.');
            expect(parts.length).toBe(3);

            // Verify the token using the public key
            const pubJwk = {
                kty: 'EC',
                crv: 'P-256',
                x: Buffer.from(publicKey.getX().toArrayLike(Buffer, 'be', 32)).toString('base64url'),
                y: Buffer.from(publicKey.getY().toArrayLike(Buffer, 'be', 32)).toString('base64url')
            };
            const pubKeyObject = crypto.createPublicKey({ format: 'jwk', key: pubJwk });

            const decoded = jwt.verify(token, pubKeyObject, { algorithms: [options.algorithm] });
            expect(decoded.sub).toBe(payload.sub);
            expect(decoded.iss).toBe(payload.iss);
        })
    })

    describe('PEM private key', () => {
        let privateKeyObj;
        let publicKeyObj;

        beforeAll(() => {
            // Generate an EC P-256 key pair
            privateKeyObj = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
            publicKeyObj = crypto.createPublicKey(privateKeyObj);

            // Export private key to PEM and write it to a temp file
            const pem = privateKeyObj.export({ format: 'pem', type: 'pkcs8' });
            const privateKeyPem = path.join(os.tmpdir(), `temp-key-${Date.now()}.pem`);
            fs.writeFileSync(privateKeyPem, pem, 'utf-8');
            config = {
                siop: {
                    privateKeyPem,
                    signAlgorithm: 'ES256'
                }
            }
        });

        afterAll(() => {
            if (fs.existsSync(config.siop.privateKeyPem)) {
                fs.unlinkSync(config.siop.privateKeyPem);
            }
        });

        it('should sign and verify a JWT using the PEM private key', () => {

            const payload = { sub: 'alice', aud: 'test-service' };
            const options = { algorithm: 'ES256', expiresIn: '1h' };

            const token = signer.signJwt(payload, options);

            const verified = jwt.verify(token, publicKeyObj, { algorithms: [options.algorithm] });

            expect(verified.sub).toBe(payload.sub);
            expect(verified.aud).toBe(payload.aud);
        });
    })
});
