/* Copyright (c) 2021 Future Internet Consulting and Development Solutions S.L.
 *
 * This file belongs to the business-ecosystem-logic-proxy of the
 * Business API Ecosystem
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const config = require('../config').siop
const fetch = require('node-fetch')
const jwksClient = require('jwks-rsa')
const jwt = require('jsonwebtoken')
const NodeCache = require('node-cache')
const { URLSearchParams } = require('url')
const logger = require('./logger').logger.getLogger("VC")


const certsValidator = (() => {
    const tokenCache = new NodeCache( { stdTTL: 100, checkperiod: 120 } )

    const loadCredential = async (req, res) => {
        // Both state and code are required
        if (!req.query.state || !req.query.code) {
            res.status(400)
                .json({ error: 'Missing required param: state and code' })
                .end()
            return
        }

        const state = req.query.state

        // Get the credential for the code
        const params = {
            'code': req.query.code,
            'grant_type': 'authorization_code',
            'redirect_uri': config.callbackURL
        };

        const verifierTokenURL = config.verifierHost + config.verifierTokenPath

        let vc
        try {
            const reqParams = new URLSearchParams(params);
            const resp = await fetch(verifierTokenURL, {
                method: 'POST',
                body: reqParams,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })

            if (resp.status > 299) {
                throw new Error('Invalid response')
            }

            const data = await resp.json()
            vc = data['access_token']
        } catch (e) {
            logger.error('VC credential token could not be retrieved')
            res.status(500)
                .json({ error: 'Error loading VC' })
                .end()
            return
        }

        // Verify the VC
        try {
            const payload = jwt.decode(vc)
            if (payload && payload['kid']) {
                const jwks = jwksClient({
                    jwksUri: config.verifierHost + config.verifierJWKSPath
                })

                const signingKey = await jwks.getSigningKey(payload['kid'])
                const publicKey = signingKey.getPublicKey()

                jwt.verify(vc, publicKey)
                tokenCache.set(state, vc)
            } else {
                logger.error('VC credential with invalid format')
                res.status(401)
                    .json({ error: 'Invalid VC token format' })
                    .end()
            }
        } catch (e) {
            logger.error('VC credential could not be verified')
            res.status(401)
                .json({ error: 'Invalid VC' })
                .end()
        }

        res.status(200)
        res.end()
    }

    const checkStatus = (req, res) => {
        if (!req.query.state) {
            res.status(400)
                .json({ error: 'Missing required param: state' })
                .end()
            return
        }

        const vc = tokenCache.get(req.query.state)

        if (vc === null || vc === undefined) {
            res.status(401)
                .json({ error: 'VC not found' })
                .end()
            return
        }

        tokenCache.del(req.query.state)

        res.status(200).json({
            vc: vc
        }).end()
    }

    return {
        loadCredential: loadCredential,
        checkStatus: checkStatus
    }
})();

exports.certsValidator = certsValidator
