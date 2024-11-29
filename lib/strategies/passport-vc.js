const { Strategy } = require('passport');
const jwt = require('jsonwebtoken');
const util = require('util');
const { URLSearchParams } = require('url');
const fetch = require('node-fetch');
const NodeCache = require('node-cache');
const jwksClient = require('jwks-rsa');
const config = require('../../config').siop
const EC = require('elliptic').ec;
const crypto = require('crypto');

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

class LEARCredSubject {
    constructor(data, issuer) {
        const mandate = data.mandate
        const individual = mandate.mandatee

        this.id = individual.id
        this.email = individual.email
        this.familyName = individual.last_name
        this.firstName = individual.first_name
        this.roles = []

        const organization = mandate.mandator
        const orgRoles = this.mapRoles(mandate)

        if (config.operators.indexOf(issuer) > -1 || config.operators.indexOf(organization.organizationIdentifier) > -1) {
            this.roles.push({
                id: 'admin',
                name: 'admin'
            })
        }

        this.organization = {
            id: organization.organizationIdentifier,
            name: organization.organization,
            roles: orgRoles
        }
    }

    mapRoles(mandate) {
        return []
    }
}

class LEARCredentialSubject extends LEARCredSubject {
    constructor(data, issuer) {
        super(data, issuer)
    }

    mapRoles(mandate) {
        return mandate.power.map((power) => {
            let role = null
            let func = ''
            let action = ''
    
            if (power.tmf_function != null) {
                func = power.tmf_function.toLowerCase()
                action = power.tmf_action
            } else {
                func = power.tmfFunction.toLowerCase()
                action = power.tmfAction
            }

            if (func == 'onboarding' && action.toLowerCase() == 'execute') {
                // orgAdmin
                role = {
                    'id': 'orgAdmin',
                    'name': 'orgAdmin'
                }
            } else if (func == 'productoffering'
                    && action.includes('Create') && action.includes('Update')) {
                // Seller
                role = {
                    'id': 'seller',
                    'name': 'seller'
                }
            } else if (func == 'certification' && (action.includes('Upload') || action.includes('post_verifiable_certification'))) {
                role = {
                    'id': 'certifier',
                    'name': 'certifier'
                }
            }

            // TBD: Customer, actions for customer role are not yet defined
            return role
        }).filter((role) => {
            return role != null
        })
    }
}

class LEARCredentialMachineSubject extends LEARCredSubject {
    constructor(data, issuer) {
        super(data, issuer)

        const mandate = data.mandate
        const individual = mandate.mandatee
        const org = mandate.mandator

        if (!this.email) {
            if (individual.contact && individual.contact.email) {
                this.email = individual.contact.email
            } else {
                this.email = org.emailAddress
            }
        }

        if (!this.familyName) {
            this.familyName = individual.serviceName
            this.firstName = individual.serviceName
        }
    }

    mapRoles(mandate) {
        return mandate.power.map((power) => {
            let role = null

            if (power.function.toLowerCase() == 'onboarding' && power.action.toLowerCase() == 'execute') {
                // orgAdmin
                role = {
                    'id': 'orgAdmin',
                    'name': 'orgAdmin'
                }
            } else if (power.function.toLowerCase() == 'productoffering'
                    && power.action.includes('Create') && power.action.includes('Update')) {
                // Seller
                role = {
                    'id': 'seller',
                    'name': 'seller'
                }
            } else if (power.function.toLowerCase() == 'certification' && (power.action.includes('Upload') || power.action.includes('post_verifiable_certification'))) {
                role = {
                    'id': 'certifier',
                    'name': 'certifier'
                }
            }

            return role
        }).filter((role) => {
            return role != null
        })
    }
}

class VerifiableCredential {
    constructor(payload) {
        const supportedCredentials = {
            LEARCredentialEmployee: LEARCredentialSubject,
            LegalPersonCredential: CredentialSubject,
            LEARCredentialMachine: LEARCredentialMachineSubject
        };

        const processSubject = (data) => {
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
        }

        if (payload.hasOwnProperty('verifiableCredential')) {
            const data = payload['verifiableCredential'];
            processSubject(data)
        } else if (payload.hasOwnProperty('vc')) {
            const data = payload['vc'];
            processSubject(data)
        } else if (payload.hasOwnProperty('verifiablePresentation')) {
            const data = payload['verifiablePresentation'].find((pres) => {
                return pres.type != null && pres.type.indexOf('LEARCredentialEmployee') > -1
            })
            processSubject(data)
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
        this.verifierHost = options.verifierHost;
        this.redirectURI = options.redirectURI;
        this.isRedirection = options.isRedirection;
        this.clientID = options.clientID;
        this.privateKey = options.privateKey;

        this._verify = verify;
        this._stateCache = new NodeCache();
    }

    makeTokenRequest(params) {
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
        }).catch((err) => {
            console.log(err)
            return this.fail('Failed to obtain access token', 500);
        });
    }

    requestTokenWithClientSign(req, authCode) {
        const tokenInfo = {
            'iss': this.clientID,
            'aud': this.verifierHost,
            'sub': this.clientID,
            'exp': Math.floor(Date.now() / 1000) + 30
        }

        try {
            const ec = new EC('p256'); // P-256 curve (also known as secp256r1)
            const key = ec.keyFromPrivate(this.privateKey);

            // Get the public key in uncompressed format (includes both x and y coordinates)
            const publicKey = key.getPublic();

            // Extract x and y coordinates and encode them in Base64url format
            const x = publicKey.getX().toString('hex'); // Hex representation of x
            const y = publicKey.getY().toString('hex'); // Hex representation of y

            const jwk = {
                kty: 'EC',
                crv: 'P-256',
                d: Buffer.from(this.privateKey, 'hex').toString('base64url'),
                x: Buffer.from(x, 'hex').toString('base64url'),
                y: Buffer.from(y, 'hex').toString('base64url')
            }

            const keyObject = crypto.createPrivateKey({ format: 'jwk', key: jwk })

            const token = jwt.sign(tokenInfo, keyObject, {
                keyid: this.clientID,
                algorithm: 'ES256'
            })

            const params = {
                'grant_type': 'authorization_code',
                'code': authCode,
                'client_id': this.clientID,
                'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                'client_assertion': token
            }

            this.makeTokenRequest(params)
        } catch (e) {
            console.log(e)
        }
    }

    requestToken(req, authCode) {
        const params = {
            'code': authCode,
            'grant_type': 'authorization_code',
            'redirect_uri': this.redirectURI
        };

        if (req.query != null && req.query.callback_url != null) {
            let oldUrl = new URL(this.redirectURI)
            let newUrl = new URL(req.query.callback_url)

            newUrl.pathname = oldUrl.pathname

            params.redirect_uri = newUrl.toString()
        }

        this.makeTokenRequest(params)
    }

    authenticatePolling(req, options) {
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

    authenticateRedirection(req, options) {
        if (!req.query || !req.query.state || !req.query.code) {
            return this.fail('Authentication failed');
        }

        const authCode = req.query.code
        this.requestTokenWithClientSign(req, authCode);
    }

    authenticate(req, options) {
        options = options || {};

        if (this.isRedirection) {
            // Process the whole login
            this.authenticateRedirection(req, options)
        } else {
            // Requires the usage of polling option
            this.authenticatePolling(req, options)
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
        const decodedToken = jwt.decode(accessToken, {'complete': true});
        const header = decodedToken.header;
        const payload = decodedToken.payload;

        // Get kid
        let kid = null
        if (header && header['kid']) {
            kid = header['kid']
        } else if (payload && payload['kid']) {
            kid = payload['kid']
        } else {
            return callback(new Error('Access token has wrong format'));
        }

        // return callback(null, payload)

        // console.log(accessToken)
        // console.log('_______________________')

        this.jwksClient.getSigningKey(kid, (err, signingKey) => {
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
    }
}

util.inherits(VCStrategy, Strategy);

exports.VerifiableCredential = VerifiableCredential;
exports.Strategy = VCStrategy;
