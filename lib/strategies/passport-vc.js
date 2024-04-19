const { Strategy } = require('passport');
const jwt = require('jsonwebtoken');
const util = require('util');
const { URLSearchParams } = require('url');
const fetch = require('node-fetch');
const NodeCache = require('node-cache');
const jwksClient = require('jwks-rsa');

class CredentialSubject {
    constructor(data, issuer) {
        if (data.email != null) {
            this.id = data.email;
            this.email = data.email;
        } else {
            // If there is not individual identification the app is
            // working only with organization so we can use the issuer
            // of ID of the profile
            this.id = `${issuer}:individual`;
            this.email = `${issuer.replaceAll(':', '.')}@email.com`
        }

        this.familyName = data.familyName;
        this.firstName = data.firstName;
        const roles = data.roles.length > 0 ? data.roles[0]: { names: [] };

        this.roles = roles.names.map(role => {
            return {
                id: role,
                name: role
            }
        });

        this.organization = {
            id: issuer,
            name: issuer,
            roles: ['seller', 'customer', 'orgAdmin'].map(role => ({
                'name': role,
                'id': role
            }))
        };
    }
}

class LEARCredentialSubject {
    constructor(data) {
        const mandate = data.mandate
        const individual = mandate.mandatee

        this.id = individual.id
        this.email = individual.email
        this.familyName = individual.last_name
        this.firstName = individual.first_name
        // TODO: How are we managing admins with this approach??
        this.roles = []

        const organization = mandate.mandator
        const orgRoles = mandate.power.map((power) => {
            let role = null
            if (power.tmf_function.toLowerCase() == 'onboarding' && power.tmf_action.toLowerCase() == 'execute') {
                // orgAdmin
                role = {
                    'id': 'orgAdmin',
                    'name': 'orgAdmin'
                }
            } else if (power.tmf_function.toLowerCase() == 'productoffering'
                    && power.tmf_action.includes('Create') && power.tmf_action.includes('Update')) {
                // Seller
                role = {
                    'id': 'seller',
                    'name': 'seller'
                }
            }
            // TBD: Customer, actions for customer role are not yet defined
            return role
        }).filter((role) => {
            return role != null
        })

        this.organization = {
            id: organization.organizationIdentifier,
            name: organization.organization,
            roles: orgRoles
        }
    }
}

class VerifiableCredential {
    constructor(payload) {
        const supportedCredentials = {
            LEARCredentialEmployee: LEARCredentialSubject,
            LegalPersonCredential: CredentialSubject
        };

        if (payload.hasOwnProperty('verifiableCredential')) {
            const data = payload['verifiableCredential'];

            // Check credential type
            let subject;
            data.type.forEach((credType) => {
                if (credType in supportedCredentials) {
                    subject = supportedCredentials[credType]
                }
            })

            if (!subject) {
                throw new Error('VC not supported');
            }

            this.credentialSubject = new subject(data.credentialSubject, data.issuer);

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
        profile.id = this.credentialSubject.id;
        profile.email = this.credentialSubject.email;

        // Build the user name from the email to ensure it is unique
        profile.username = profile.email.split('@')[0];

        profile.displayName = `${this.credentialSubject.firstName} ${this.credentialSubject.familyName}`;
        profile.roles = this.credentialSubject.roles;
        profile.issuerDid = this.issuer;
        profile.idpId = this.issuer;

        profile._json = this.payload;

        profile.organizations = [this.credentialSubject.organization]
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

exports.VerifiableCredential = VerifiableCredential;
exports.Strategy = VCStrategy;
