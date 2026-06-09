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
const responseRewriter = require('./../federation/lib/responseRewriter').responseRewriter
const tmfApiHelpers = require('./../lib/tmfApiHelpers').tmfApiHelpers
const utils = require('./../lib/utils')


const logger = require('./../lib/logger').logger.getLogger('TMF')

function simulator() {
    const CUSTOMER = config.roles.customer;
    const SELLER = config.roles.seller;

    const getLocalPartySourceEndpoint = function() {
        const partyEndpoint = config.tmforum && config.tmforum.party;
        if (!partyEndpoint) {
            return '';
        }

        return utils.getAPIURL(
            partyEndpoint.appSsl,
            partyEndpoint.host,
            partyEndpoint.port,
            partyEndpoint.apiPath || ''
        );
    }

    const checkBillAcc = async (billAccRef, userId) =>{
        if (billAccRef && billAccRef.id){
            const billAccURL = utils.getAPIURL(
                config.tmforum.account.appSsl,
                config.tmforum.account.host,
                config.tmforum.account.port,
                `${config.tmforum.account.apiPath}/billingAccount/${billAccRef.id}`)

            let billAcc;

            try {
                const resp = await axios.get(billAccURL);
                billAcc = resp.data;
            } catch (_) {
                throw new Error("Invalid billing account id");
            }

            const matches =  billAcc.relatedParty.some(p => p?.id === userId)

            if (billAcc && matches) return billAcc;

            throw new Error("Cannot find the specified billing account for this user");

        }
        else { // get preferred billing account else returns null
            const billAccURL = utils.getAPIURL(
                config.tmforum.account.appSsl,
                config.tmforum.account.host,
                config.tmforum.account.port,
                `${config.tmforum.account.apiPath}/billingAccount?relatedParty.id=${userId}`)

            try {
                const resp = await axios.get(billAccURL);
                const result = resp.data;

                for (const billAcc of result) {
                    // Find default bill acc
                    if (billAcc.contact && billAcc.contact[0] && billAcc.contact[0].contactMedium) {
                        for (const medium of billAcc.contact[0].contactMedium) {
                            if (medium.preferred && medium.mediumType === "PostalAddress") {
                                return billAcc; // Return the entire billing account object
                            }
                        }
                    }
                }
                return null
            } catch (error) {
                throw new Error("Error searching for preferred billing address");
            }
                }
    }

    const simulate = async (req, res) => {
        let targetUrl = config.billingEngineUrl;

        if (!targetUrl) {
            logger.error('TARGET_URL is not defined');
            return res.status(500).send('Internal Server Error');
        }

        let simUrl = targetUrl;

        // Related parties need to be included in the request body
        let body;
        try {
            body = JSON.parse(req.body);
        } catch (error) {
            return res.status(400).send('Invalid JSON body');
        }

        const order = body.productOrder;
        if (!order) {
            return res.status(400).send('Missing productOrder in request body');
        }
        order.relatedParty = [];

        try {
            const customerId = responseRewriter.buildFederatedReferenceId(
                getLocalPartySourceEndpoint(),
                req.user.partyId
            );
            order.relatedParty.push({
                id: customerId,
                role: CUSTOMER,
                href: customerId,
                '@referredType': 'organization'
            });
        }
        catch (error){
            return res.status(400).send('Expired credentials')
        }
        try {
            if (req.user.partyId.split(':')[2] === 'individual'){
                order.billingAccount ={...order.billingAccount, resolved: await checkBillAcc(order.billingAccount, req.user.partyId)}
            }
        }
        catch (error) {
            return res.status(400).send(error.message)
        }

        // Only one item is supported in the billing preview
        try {
            const offeringRef = order.productOrderItem[0].productOffering.id
            const offeringResp = await tmfApiHelpers.getAssetById(
                config.tmforum.catalog,
                'productOffering',
                offeringRef,
                req
            )
            const prodRef = offeringResp.body.productSpecification.id
            const prodResp = await tmfApiHelpers.getAssetById(
                config.tmforum.catalog,
                'productSpecification',
                prodRef,
                req,
                {
                    sourceEndpoint: offeringResp.sourceEndpoint
                }
            )

            prodResp.body.relatedParty.forEach(element => {
                if (element.role.toLowerCase() == SELLER.toLowerCase()) {
                    const partySourceEndpoint = prodResp.sourceEndpoint || offeringResp.sourceEndpoint;
                    const partyId = responseRewriter.buildFederatedReferenceId(partySourceEndpoint, element.id);
                    order.relatedParty.push({
                        id: partyId,
                        role: SELLER,
                        href: partyId,
                        '@referredType': 'organization'
                    })
                }
            });
        } catch (error) {
            console.log(error)
            return res.status(400).send('Error retrieving parties');
        }

        body.productOrder = order
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

    const simulateRaw = async (req, res) => {
        let targetUrl = config.billingEngineUrl;

        if (!targetUrl) {
            logger.error('TARGET_URL is not defined');
            return res.status(500).send('Internal Server Error');
        }

        let simUrl = targetUrl;

        axios({
            method: req.method,
            url: simUrl,
            data: req.body,
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
        simulate: simulate,
        simulateRaw: simulateRaw
    }
}

exports.simulator = simulator;
