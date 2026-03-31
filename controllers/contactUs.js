/* Copyright (c) 2026 Future Internet Consulting and Development Solutions S.L.
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

const axios = require('axios');
const config = require('../config');
const utils = require('../lib/utils');
const logger = require('../lib/logger').logger.getLogger('ContactUs');

function contactUs() {
    const getNotificationUrl = function() {
        if (config.contactUsNotificationUrl) {
            return config.contactUsNotificationUrl;
        }

        return utils.getAPIURL(
            config.endpoints.charging.appSsl,
            config.endpoints.charging.host,
            config.endpoints.charging.port,
            `${config.endpoints.charging.apiPath}/charging/api/orderManagement/notify/configured`
        );
    };

    const sendNotification = async function(req, res) {
        let body;

        try {
            body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (_) {
            return res.status(400).send('Invalid JSON body');
        }

        const formatBoolean = function(value) {
            return value ? 'Yes' : 'No';
        };

        const escapeHtml = function(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        const getValue = function(value) {
            return value == null ? '' : escapeHtml(value);
        };

        const messageText = getValue(body.message).replace(/\r?\n/g, '<br>');

        const message = [
            `First name: ${getValue(body.firstName)}`,
            `Last name: ${getValue(body.lastName)}`,
            `Email: ${getValue(body.email)}`,
            `Organization: ${getValue(body.organization)}`,
            `Role in organization: ${getValue(body.roleInOrganization)}`,
            `Privacy accepted: ${formatBoolean(body.privacyAccepted)}`,
            `Marketing accepted: ${formatBoolean(body.marketingAccepted)}`,
            '',
            'Message:',
            messageText
        ].join('<br>');

        try {
            const response = await axios({
                method: 'POST',
                url: getNotificationUrl(),
                data: {
                    subject: "New contact-us request",
                    message: message
                },
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            res.status(response.status).send(response.data);
        } catch (error) {
            logger.error('Error sending contact-us notification: %s', error.message);

            if (error.response && error.response.data) {
                return res.status(error.response.status).send(error.response.data);
            }

            return res.status(500).send('Internal Server Error');
        }
    };

    return {
        sendNotification: sendNotification
    };
}

exports.contactUs = contactUs;
