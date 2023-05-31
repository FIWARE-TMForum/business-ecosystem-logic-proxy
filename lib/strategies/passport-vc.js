const { Strategy } = require('passport');
const jwt = require('jsonwebtoken');
const util = require('util');
const { URLSearchParams } = require('url');
const fetch = require('node-fetch');
const NodeCache = require('node-cache');

class VCStrategy extends Strategy {
    constructor(options, verify) {
        super();
        this.credentialType = options.credentialType;
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
            const payload = jwt.decode(accessToken);
            const profile = {};

            if (payload['verifiableCredential']) {
                const verifiableCredential = payload['verifiableCredential'];
                if (Array.isArray(verifiableCredential['type']) && Array.isArray(this.credentialType) &&
                    verifiableCredential['type'].every(el => this.credentialType.includes(el))) {
                    if (Date.parse(verifiableCredential['validFrom']) > Date.now()) {
                        done(new Error('VC is not yet valid'));
                    } else if (Date.parse(verifiableCredential['expirationDate']) < Date.now()) {
                        done(new Error('VC has expired'));
                    } else {
                        const credentialSubject = verifiableCredential['credentialSubject'];
                        profile.email = credentialSubject['email'];
                        profile.displayName = `${credentialSubject['firstName']} ${credentialSubject['familyName']}`;
                        profile.username = profile.displayName;
                        profile.id = verifiableCredential['credentialSubject']['id'];
                        profile.roles = verifiableCredential['credentialSubject']['roles'].map(role => {
                            return {
                                id: role['names'][0],
                                name: role['names'][0]
                            }
                        });
                        profile._json = payload;
                    }
                } else {
                    done(new Error('VC type is not allowed'));
                }
            } else {
                done(new Error('VC not found'));
            }

            done(null, profile);
        } catch (e) {
            done(e);
        }
    }
}

util.inherits(VCStrategy, Strategy);

exports.Strategy = VCStrategy;