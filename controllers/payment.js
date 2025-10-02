/* Copyright (c) 2025 Future Internet Consulting and Development Solutions S.L.
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
const config = require('../config')
const logger = require('../lib/logger').logger.getLogger("Server");

function payment () {

    const getPaymentInfo = async function(req, res) {
        const partyId = req.user.partyId;

        logger['info']('%s: %s', "Reading payment info from: ", partyId);

        // Get the number of payment options the provider has
        const gatewaysUrl = `${config.paymentGateway}/api/product-providers/payment-gateways/count?productProviderExternalId=${partyId}`;

        let gatewaysCount = 0;
        try {
            const resp = await axios.get(gatewaysUrl)
            gatewaysCount = parseInt(resp.data);
        } catch (err) {
            logger['error']('%s: %s', "Error getting payment gateways count", err.message);
        }

        res.json({
            gatewaysCount: gatewaysCount,
            providerUrl: `${config.paymentGateway}/provider-admin/#/login?productProviderId=${partyId}`
        })
    }

    return {
        getPaymentInfo: getPaymentInfo
    }
}

exports.payment = payment;