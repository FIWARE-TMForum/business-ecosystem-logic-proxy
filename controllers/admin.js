/* Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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

const axios = require('axios')
const config = require('./../config')
const utils = require('./../lib/utils')
const uuidv4 = require('uuid').v4

const logger = require('./../lib/logger').logger.getLogger('Admin')

function admin() {

    const redirRequest = function(options, req, res) {
        axios.request(options).then((resp) => {
            res.status(resp.status)

            for (let header in resp.headers) {
                res.setHeader(header, resp.headers[header]);
            }

            if (resp.headers['content-type'].toLowerCase().indexOf('application/json') >= 0 || resp.headers['content-type'].toLowerCase().indexOf('application/ld+json') >= 0) {
                res.json(resp.data)
            } else {
                res.write(resp.data);
                res.end();
            }
        }).catch((err) => {
            utils.log(logger, 'error', req, 'Proxy error: ' + err.message)

            if (err.response) {
                res.status(err.response.status)
                res.json(err.response.data)
            } else {
                res.status(504)
                res.json({ error: 'Service unreachable' })
            }
        })
    }

    function isOrgAuth(user) {
        return user.organizations.filter((org) => {
            return org.roles.filter((role) => {
                return role.name.toLowerCase() == 'certifier'
            }).length > 0
        }).length > 0
    }

    const uploadCertificate = async function (req, res) {
        // Check user permissions
        if (!utils.isAdmin(req.user) && !utils.hasRole(req.user, 'certifier') && !isOrgAuth(req.user)) {
            res.status(403)
            res.json({ error: "You are not authorized to upload certificates" })
            return
        }

        let vc
        try {
            const reqBody = JSON.parse(req.body)
            vc = reqBody.vc
        } catch (e) {
            res.status(400)
            res.json({ error: 'Invalid body' })
            return
        }

        if (vc == null) {
            res.status(400)
            res.json({ error: 'Missing VC' })
            return
        }

        // Get the product Specification
        let productSpec;

        const specId = req.params.specId
        const url = `${utils.getAPIProtocol('catalog')}://${utils.getAPIHost('catalog')}:${utils.getAPIPort('catalog')}/productSpecification/${specId}`

        try {
            const options = {
                url: url,
			    method: 'GET'
            }
            productSpec = (await axios.request(options)).data
        } catch (e) {
            res.status(404)
            res.json({ error: 'The product spec does not exists' })
            return
        }

        // Patch the spec
        let body = {
            productSpecCharacteristic: productSpec.productSpecCharacteristic != null ? productSpec.productSpecCharacteristic.filter((char) => {
              return char.name != 'Compliance:VC'
            }) : []
        }

        // Add the credential as a characteristic
        body.productSpecCharacteristic.push({
            id: `urn:ngsi-ld:characteristic:${uuidv4()}`,
            name: `Compliance:VC`,
            productSpecCharacteristicValue: [{
                isDefault: true,
                value: vc
            }]
        })

        const patchOptions = {
            url: url,
            method: 'PATCH',
            data: body,
            headers: {
                'content-type': 'application/json'
            }
        }

        redirRequest(patchOptions, req, res)
    }

    const checkPermissions = function (req, res) {
        // Check if the user is an admin
        if (!utils.isAdmin(req.user)) {
            res.status(403)
            res.json({ error: "You are not authorized to access admin endpoint" })
            return
        }

        // If the user is an admin redirect the request
        // without extra validation
        const api = req.apiUrl.split('/')[2]
        const url = utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + req.apiUrl.replace(`/admin/${api}`, '')

        utils.attachUserHeaders(req.headers, req.user)

        const options = {
			url: url,
			method: req.method,
			headers: utils.proxiedRequestHeaders(req)
		};


		if (typeof req.body === 'string') {
			options.data = req.body;
		}

		if (url.indexOf('/media/') >= 0) {
			options.responseType = 'arraybuffer'

			// Dissable default browser cache headers
			delete options.headers['if-modified-since'];
			delete options.headers['if-none-match'];

			options.headers['cache-control'] = 'no-cache';
		}

        redirRequest(options, req, res)
    }

    return {
        checkPermissions: checkPermissions,
        uploadCertificate: uploadCertificate
    }
}

exports.admin = admin;
