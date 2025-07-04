/* Copyright (c) 2024 Future Internet Consulting and Development Solutions S.L.
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


const logger = require('./../lib/logger').logger.getLogger('TMF')

function simulator() {
    const CUSTOMER = 'Customer';
    const SELLER = 'Seller';

    const simulate = async (req, res) => {
        let targetUrl = config.billingEngineUrl;

        if (!targetUrl) {
            logger.error('TARGET_URL is not defined');
            return res.status(500).send('Internal Server Error');
        }

        if (!targetUrl.endsWith('/')) {
            targetUrl += '/';
        }

        //let simUrl = targetUrl + 'billing/previewPrice'
        let simUrl = targetUrl + 'charging/api/orderManagement/orders/preview/'

        // Related parties need to be included in the request body
        let body;
        try {
            body = JSON.parse(req.body);
        } catch (error) {
            return res.status(400).send('Invalid JSON body');
        }

        body.relatedParty = [];

        body.relatedParty.push({
            id: req.user.partyId,
            role: CUSTOMER,
            href: req.user.partyId,
            '@referredType': 'organization'
        });

        // Only one item is supported in the billing preview
        try {
            const offeringRef = body.productOrderItem[0].productOffering.id
            // Get the offering
            const offeringUrl = utils.getAPIURL(
                config.endpoints.catalog.appSsl,
                config.endpoints.catalog.host,
                config.endpoints.catalog.port,
                `${config.endpoints.catalog.apiPath}/productOffering/${offeringRef}`)

            let resp = await axios({
                method: 'GET',
                url: offeringUrl
            })

            const prodRef = resp.data.productSpecification.id
            const productUrl = utils.getAPIURL(
                config.endpoints.catalog.appSsl,
                config.endpoints.catalog.host,
                config.endpoints.catalog.port,
                `${config.endpoints.catalog.apiPath}/productSpecification/${prodRef}`)

            let prodResp = await axios({
                method: 'GET',
                url: productUrl
            })

            prodResp.data.relatedParty.forEach(element => {
                if (element.role.toLowerCase() == 'owner') {
                    body.relatedParty.push({
                        id: element.id,
                        role: SELLER,
                        href: element.id,
                        '@referredType': 'organization'
                    })
                }
            });
        } catch (error) {
            console.log(error)
            return res.status(400).send('Error retrieving parties');
        }
        
        console.log(JSON.stringify(body))

        axios({
            method: req.method,
            url: simUrl,
            data: body,
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            res.status(response.status).send(response.data);
        })
        .catch(error => {
            logger.error('Error making request to target service:', error);
            if (error.response && error.response.data) {
                return res.status(error.response.status).send(error.response.data);
            }
            res.status(500).send('Internal Server Error');
        });
    }

    return {
        simulate: simulate
    }
}

exports.simulator = simulator;
