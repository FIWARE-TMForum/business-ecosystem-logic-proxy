const { Strategy } = require('passport');
const jwt = require('jsonwebtoken');
const util = require('util');
const { URLSearchParams } = require('url');
const fetch = require('node-fetch');
const NodeCache = require('node-cache');
const jwksClient = require('jwks-rsa');

class CredentialSubject {
    constructor(data) {
        this.email = data.email;
        this.familyName = data.familyName;
        this.firstName = data.firstName;
        this.id = data.id;
        this.roles = data.roles.map(role => {
            const firstRole = role.names.length > 0 ? role.names[0]: null;
            return {
                id: firstRole,
                name: firstRole
            }
        });
    }
}

class VerifiableCredential {
    constructor(payload) {
        if (Object.hasOwn(payload, 'verifiableCredential')) {
            const data = payload['verifiableCredential'];
            this.credentialSubject = new CredentialSubject(data.credentialSubject);
            this.type = data.type;
            this.payload = payload;
        } else {
            throw new Error('VC not found');
        }
    }

    verifyType(type) {
        if (
            !((Array.isArray(this.type) && Array.isArray(type) && this.type.every(el => type.includes(el))) ||
            this.type === type)
        ) {
            throw new Error('VC type is not allowed');
        }
    }

    verifyRole(allowedRoles) {
        if (!this.credentialSubject.roles.every(role => allowedRoles.includes(role.id))) {
            throw new Error('VC role is not allowed');
        }
    }

    getProfile() {
        const profile = {};
        profile.email = this.credentialSubject.email;
        profile.displayName = `${this.credentialSubject.firstName} ${this.credentialSubject.familyName}`;
        profile.username = profile.displayName;
        profile.id = this.credentialSubject.id;
        profile.roles = this.credentialSubject.roles;
        profile._json = this.payload;
        return profile;
    }
}

class VCStrategy extends Strategy {
    constructor(options, verify) {
        super();
        this.jwksClient = jwksClient({
            jwksUri: options.verifierJWKSURL
        });
        this.allowedCredentialType = options.allowedCredentialType;
        this.allowedRoles = options.allowedRoles;
        this.verifierTokenURL = options.verifierTokenURL;
        this.redirectURI = options.redirectURI;
        this._verify = verify;
        this._stateCache = new NodeCache();
    }

    requestToken(req, authCode) {
        const params = {
            'code': authCode,
            'grant_type': 'authorization_code',
            'redirect_uri': this.redirectURI
        };
        const reqParams = new URLSearchParams(params);
        fetch(this.verifierTokenURL, {
            method: 'POST',
            body: reqParams,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }).then(async res => {
            if (res.status === 200) {
                const data = await res.json();
                this.loadUserProfile(data['access_token']);
            } else {
                return this.fail('Failed to obtain access token', 500);
            }
        }).catch(() => {
            return this.fail('Failed to obtain access token', 500);
        });
    }

    authenticate(req, options) {
        options = options || {};

        if (req.query && req.query.state && req.query.code) {
            this._stateCache.set(req.query.state, req.query.code);
            return this.pass();
        } else if (options.poll && options.state) {
            const authCode = this._stateCache.get(options.state);
            if (authCode === null || authCode === undefined) {
                return this.fail('No auth code received yet');
            }
            this._stateCache.del(options.state);
            this.requestToken(req, authCode);
        } else {
            return this.fail('Authentication failed');
        }
    }

    loadUserProfile(accessToken) {
        const refreshToken = accessToken;

        this.userProfile(accessToken, (err, profile) => {
            if (err) {
                return this.error(err);
            }

            const verified = (err, user, info) => {
                if (err) {
                    return this.error(err);
                }
                if (!user) {
                    return this.fail(info);
                }

                this.success(user, info|| {});
            }

            this._verify(accessToken, refreshToken, profile, verified);
        });
    }

    userProfile(accessToken, done) {
        try {
            try {
                this.verifyToken(accessToken, (err, payload) => {
                    if (err) {
                        done(err);
                    }
                    const verifiableCredential = new VerifiableCredential(payload);
                    verifiableCredential.verifyType(this.allowedCredentialType);
                    verifiableCredential.verifyRole(this.allowedRoles);
                    done(null, verifiableCredential.getProfile());
                });
            } catch (e) {
                done(e);
            }
        } catch (e) {
            done(e);
        }
    }

    verifyToken(accessToken, callback) {
        const payload = jwt.decode(accessToken);
        if (payload && payload['kid']) {
            this.jwksClient.getSigningKey(payload['kid'], (err, signingKey) => {
                if (err) {
                    callback(err);
                }
                const publicKey = signingKey.getPublicKey();
                jwt.verify(accessToken, publicKey, (err, decoded) => {
                    if (err) {
                        callback(err);
                    }
                    callback(null, decoded);
                });
            });
        } else {
            callback(new Error('Access token has wrong format'));
        }
    }
}

util.inherits(VCStrategy, Strategy);

exports.Strategy = VCStrategy;