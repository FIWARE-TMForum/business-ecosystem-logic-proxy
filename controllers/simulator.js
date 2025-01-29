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


const logger = require('./../lib/logger').logger.getLogger('TMF')

function simulator() {
    const simulate = (req, res) => {
        const targetUrl = config.billingEngineUrl;

        if (!targetUrl) {
            logger.error('TARGET_URL is not defined');
            return res.status(500).send('Internal Server Error');
        }

        axios({
            method: req.method,
            url: targetUrl + 'billing/previewPrice',
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
        simulate: simulate
    }
}

exports.simulator = simulator;
