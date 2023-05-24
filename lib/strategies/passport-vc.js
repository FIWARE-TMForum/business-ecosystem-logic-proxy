const { Strategy } = require('passport');
const jwt = require('jsonwebtoken');
const util = require('util');
const { URLSearchParams } = require('url');
const fetch = require('node-fetch');
const NodeCache = require('node-cache');

class VCStrategy extends Strategy {
    constructor(options, verify) {
        super();
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
                req.session.access_token = data['access_token'];
                this.loadUserProfile(req);
            } else {
                return this.fail('Failed to obtain access token', 500);
            }
        }).catch(() => {
            return this.fail('Failed to obtain access token', 500);
        });
    }

    authorizeRequest(req) {
        this.loadUserProfile(req);
    }

    authenticate(req, options) {
        options = options || {};

        if (req.query && req.query.error) {
            return this.fail({ message: 'Authentication failed' });
        }

        if (req.query && req.query.state && req.query.code) {
            this._stateCache.set(req.query.state, req.query.code);
            // return this.success({}, null);
            return this.pass();
        } else if (options.poll && options.state) {
            // if (Date.now() > req.session.cookie.expires) {
            //     return this.fail('Session has expired', 400);
            // }
            const authCode = this._stateCache.get(options.state);
            if (authCode === null || authCode === undefined) {
                return this.fail('No auth code received yet');
            }
            this._stateCache.del(options.state);
            this.requestToken(req, authCode);
        } else {
            this.authorizeRequest(req);
        }
    }

    loadUserProfile(req) {
        const accessToken = req.session.access_token;
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

                info = info || {};
                if (req.query && req.query.state) {
                    info.state = req.query.state;
                }
                this.success(user, info);
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
                if (Date.parse(verifiableCredential['validFrom']) > Date.now()) {
                    done(new Error('VC is not yet valid'));
                } else if (Date.parse(verifiableCredential['expirationDate']) < Date.now()) {
                    done(new Error('VC has expired'));
                } else {
                    const credentialSubject = verifiableCredential['credentialSubject'];
                    profile.email = credentialSubject['email'];
                    profile.displayName = `${credentialSubject['firstName']} ${credentialSubject['familyName']}`
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