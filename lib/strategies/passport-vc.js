const { Strategy } = require('passport');
const jwt = require('jsonwebtoken');
const util = require('util');
const { URLSearchParams } = require('url');
const fetch = require('node-fetch');
const NodeCache = require('node-cache');
const { certToPEM } = require('jwks-rsa');
const config = require('../../config').siop
const EC = require('elliptic').ec;
const crypto = require('crypto');
const { HttpsProxyAgent } = require('https-proxy-agent');
const jwkToPem = require('jwk-to-pem');

const proxyUrl = process.env.HTTPS_PROXY || ''

class CredentialSubject {
    constructor(credSubj, issuer) {
        if (credSubj.email != null) {
            this.id = credSubj.email;
            this.email = credSubj.email;
        } else {
            // If there is not individual identification the app is
            // working only with organization so we can use the issuer
            // of ID of the profile
            this.id = `${issuer}:individual`;
            this.email = `${issuer.replaceAll(':', '.')}@email.com`
        }

        this.familyName = credSubj.familyName;
        this.firstName = credSubj.firstName;
        const roles = credSubj.roles.length > 0 ? credSubj.roles[0]: { names: [] };

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
    constructor(credSubj, issuer) {
        const mandate = credSubj.mandate
        const individual = mandate.mandatee

        this.id = individual.id
        this.email = individual.email
        this.familyName = individual.last_name
        this.firstName = individual.first_name
        this.roles = []

        const organization = mandate.mandator
        const orgRoles = this.mapRoles(mandate)

        if ((!!issuer && config.operators.indexOf(issuer.id) > -1) || config.operators.indexOf(issuer) > -1 || config.operators.indexOf(organization.organizationIdentifier) > -1) {
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

        if (!!organization.country) {
            this.organization.country = organization.country
        }
    }

    mapRoles(mandate) {
        return []
    }
}

class LEARCredentialSubject extends LEARCredSubject {
    constructor(credSubj, issuer) {
        super(credSubj, issuer)
    }

    mapRoles(mandate) {
        const hasPower = (action, power_name) => {
            let actions;

            if (typeof action == 'string') {
                actions = [action]
            } else {
                actions = action
            }

            return actions.some((act) => {
                return act.toLowerCase() == power_name.toLowerCase()
            })
        }

        return mandate.power.map((power) => {
            let role = null
            let func = ''
            let action = ''
            let v2 = false
    
            if (power.function != null){ // V2
                func = power.function.toLowerCase()
                action = power.action
                v2 = true
            }
            else if (power.tmf_function != null) {
                func = power.tmf_function.toLowerCase()
                action = power.tmf_action
            } else {
                func = power.tmfFunction.toLowerCase()
                action = power.tmfAction
            }

            if (func == 'onboarding' && hasPower(action, 'execute')){
                // orgAdmin
                role = {
                    'id': 'orgAdmin',
                    'name': 'orgAdmin'
                }
            } else if ('productoffering' && hasPower(action, 'create') && hasPower(action, 'update')) {
                // Seller
                role = {
                    'id': 'seller',
                    'name': 'seller'
                }
            } else if (func == 'certification' && (hasPower(action, 'upload') || hasPower(action, 'post_verifiable_certification') ||  hasPower(action, 'uploadCertificate'))) {
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
    constructor(credSubj, issuer) {
        super(credSubj, issuer)

        const mandate = credSubj.mandate
        const individual = mandate.mandatee
        const org = mandate.mandator

        if (!this.email) {
            if (individual.contact && individual.contact.email) {
                this.email = individual.contact.email
            } else {
                this.email = org.emailAddress ? org.emailAddress : org.email;
            }
        }

        if (!this.familyName) {
            this.familyName = individual.serviceName
            this.firstName = individual.serviceName
        }
    }

    mapRoles(mandate) {
        const hasPower = (action, power_name) => {
            let actions;

            if (typeof action == 'string') {
                actions = [action]
            } else {
                actions = action
            }

            return actions.some((act) => {
                return act.toLowerCase() == power_name.toLowerCase()
            })
        }

        return mandate.power.map((power) => {
            let func = ''
            let action = ''
            let role = null

            if (power.function != null){ // V2
                func = power.function.toLowerCase()
                action = power.action
            }
            else if (power.tmf_function != null) {
                func = power.tmf_function.toLowerCase()
                action = power.tmf_action
            } else {
                func = power.tmfFunction.toLowerCase()
                action = power.tmfAction
            }

            if (func == 'onboarding' && hasPower(action, 'execute')) {
                // orgAdmin
                role = {
                    'id': 'orgAdmin',
                    'name': 'orgAdmin'
                }
            } else if (func == 'productoffering'
                    && hasPower(action, 'create') && hasPower(action, 'update')) {
                // Seller
                role = {
                    'id': 'seller',
                    'name': 'seller'
                }
            } else if (func == 'certification' && (hasPower(action, 'upload') || hasPower(action, 'post_verifiable_certification'))) {
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
            const types = Array.isArray(data.type) ? data.type : [data.type];

            types.forEach((credType) => {
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
       
        this.verifierJWKSURL = options.verifierJWKSURL;
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
        console.log('-------> Making token request')
        const reqParams = new URLSearchParams(params);
        let req;
        if (proxyUrl != '') {
            const agent = new HttpsProxyAgent(proxyUrl); 
            req = {
                method: 'POST',
                body: reqParams,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                agent: agent
            }
        } else {
            req = {
                method: 'POST',
                body: reqParams,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        }

        fetch(this.verifierTokenURL, req).then(async res => {
            if (res.status === 200) {
                console.log('-------> We got the token response')
                const data = await res.json();

                let refreshToken = data['access_token'];
                if (data['refresh_token']) {
                    refreshToken = data['refresh_token'];
                }

                console.log('-------> We parse the token info')
                this.loadUserProfile(data['access_token'], refreshToken);
            } else {
                console.log('-------> Error getting access token from the verifier')
                console.log(res)
                return this.fail('Failed to obtain access token', 500);
            }
        }).catch((err) => {
            console.log(err)
            return this.fail('Failed to obtain access token', 500);
        });
    }

    buildClientAssertion() {
        console.log('-------> In client assertion')
        const tokenInfo = {
            'iss': this.clientID,
            'aud': this.verifierHost,
            'sub': this.clientID,
            'exp': Math.floor(Date.now() / 1000) + 30
        }
        const ec = new EC('p256'); // P-256 curve (also known as secp256r1)
        const key = ec.keyFromPrivate(this.privateKey);
        console.log('-------> We got the private key')

        // Get the public key in uncompressed format (includes both x and y coordinates)
        const publicKey = key.getPublic();
        console.log('-------> We got the public key')

        // Extract x and y coordinates and encode them in Base64url format
        const x = publicKey.getX().toString('hex'); // Hex representation of x
        const y = publicKey.getY().toString('hex'); // Hex representation of y
        console.log('-------> We got the coordinates')

        const jwk = {
            kty: 'EC',
            crv: 'P-256',
            d: Buffer.from(this.privateKey, 'hex').toString('base64url'),
            x: Buffer.from(x, 'hex').toString('base64url'),
            y: Buffer.from(y, 'hex').toString('base64url')
        }

        const keyObject = crypto.createPrivateKey({ format: 'jwk', key: jwk })
        console.log('-------> We got the key object')

        const token = jwt.sign(tokenInfo, keyObject, {
            keyid: this.clientID,
            algorithm: 'ES256'
        })

        console.log('-------> We got the token signed')
        return token
    }

    requestTokenWithClientSign(req, authCode) {
        console.log('---------> Req token with client sign')
        try {
            const token = this.buildClientAssertion();

            console.log('--------> Token assetion ready' + token)
            const params = {
                'grant_type': 'authorization_code',
                'code': authCode,
                'client_id': this.clientID,
                'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                'client_assertion': token
            }

            this.makeTokenRequest(params)
        } catch (e) {
            console.log('-------> Error captured in request token ')
            console.log(e)
        }
    }

    requestTokenWithRefreshToken(refreshToken) {
        console.log('---------- Calling refresh method in strategy');
        try {
            const token = this.buildClientAssertion();
            const params = {
                'grant_type': 'refresh_token',
                'refresh_token': refreshToken,
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
            console.log('---------> Auth failed missing query params')
            return this.fail('Authentication failed');
        }

        const authCode = req.query.code
        this.requestTokenWithClientSign(req, authCode);
    }

    authenticate(req, options) {
        options = options || {};

        if (this.isRedirection) {
            // Process the whole login
            console.log('--------> Authenticate redirection')
            this.authenticateRedirection(req, options)
        } else {
            console.log('--------> Authenticate polling')
            // Requires the usage of polling option
            this.authenticatePolling(req, options)
        }
    }

    refresh(refreshToken, done) {
        console.log('---------- Calling refresh method in strategy');
        let params
        try {
            const token = this.buildClientAssertion();
            params = {
                'grant_type': 'refresh_token',
                'refresh_token': refreshToken,
                'client_id': this.clientID,
                'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
                'client_assertion': token
            }
        } catch (e) {
            console.log(e)
            done('Error building client assertion')
            return
        }

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

                let refreshToken = data['access_token'];
                if (data['refresh_token']) {
                    refreshToken = data['refresh_token'];
                }
                done(null, data['access_token'], refreshToken)
            } else {
                done('Failed to obtain access token')
            }

        }).catch((err) => {
            console.log(err)
            done('Failed to obtain access token')
        });
    }

    loadUserProfile(accessToken, refreshToken) {

        console.log('-------> Calling user profile method')
        this.userProfile(accessToken, (err, profile) => {
            if (err) {
                console.log('-------> Error from the user profile')
                console.log(err)
                return this.error(err);
            }

            const verified = (err, user, info) => {
                if (err) {
                    console.log('-------> Error in verify')
                    return this.error(err);
                }
                if (!user) {
                    console.log('-------> Missing user in verify')
                    return this.fail(info);
                }

                console.log('-------> Login succeed')
                this.success(user, info|| {});
            }

            console.log('-------> Calling external verify')
            this._verify(accessToken, refreshToken, profile, verified);
        });
    }

    userProfile(accessToken, done) {
        console.log('-------> In userprofile')
        try {
            try {
                console.log('-------> Calling verify token')
                this.verifyToken(accessToken, (err, payload) => {
                    if (err) {
                        console.log('-------> Error in verify token')
                        return done(err);
                    }

                    console.log('-------> Building credential')
                    const verifiableCredential = new VerifiableCredential(payload);

                    console.log('-------> Checking roles')
                    verifiableCredential.verifyRole(this.allowedRoles);

                    console.log('-------> Profile ready')
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
        console.log('-------> In verify token ' + accessToken)
        const decodedToken = jwt.decode(accessToken, {'complete': true});

        console.log('-------> Token decoded')
        const header = decodedToken.header;
        const payload = decodedToken.payload;

        // Get kid
        let kid = null
        if (header && header['kid']) {
            kid = header['kid']
        } else if (payload && payload['kid']) {
            kid = payload['kid']
        } else {
            console.log('-------> Missing kid in token')
            return callback(new Error('Access token has wrong format'));
        }

        const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
        console.log('-------> Accessing JWSK endpoint')
        fetch(this.verifierJWKSURL, { agent })
            .then(async res => {
                if (res.status === 200) {
                    const jwks = await res.json();
                    const keyData = jwks.keys.find(k => k.kid === kid);
                    console.log('-------> Key data loaded')
                    if (!keyData) {
                        console.log(`-------> Key not found for kid ${kid}`)
                        return callback(`Key not found for kid ${kid}`);
                    }
                    const pubKey = jwkToPem(keyData)
                    console.log('-------> Public key loaded')
                    jwt.verify(accessToken, pubKey, (err, decoded) => {
                        if (err) {
                            console.log('-------> Error in JWT verify')
                            console.log(err)
                            return callback(err);
                        }
        
                        console.log('-------> Public key verified')
                        callback(null, decoded);
                    });
                } else {
                    console.log('-------> Error Accessing JWSK endpoint')
                    callback('Failed to obtain jwks')
                }
    
            }).catch((err) => {
                console.log('-------> Exception Accessing JWSK endpoint')
                console.log(err)
                callback(err)
            });

    }
}

util.inherits(VCStrategy, Strategy);

exports.VerifiableCredential = VerifiableCredential;
exports.Strategy = VCStrategy;
