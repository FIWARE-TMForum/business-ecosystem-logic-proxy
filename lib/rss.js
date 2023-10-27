/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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
const config = require('./../config');
const utils = require('./utils');

const rssClient = (function() {
    const makeModelsRequest = function(userInfo, model, query, callback) {
        const headers = {
            'content-type': 'application/json',
            Accept: 'application/json'
        };

        utils.attachUserHeaders(headers, userInfo);

        const url = utils.getAPIURL(
            config.endpoints.charging.appSsl,
            config.endpoints.charging.host,
            config.endpoints.charging.port,
            config.endpoints.charging.path + '/api/revenueSharing/models' + query
        );

        const options = {
            url: url,
            method: 'GET',
            headers: headers
        };

        if (model) {
            options.method = 'POST';
            options.data = model;
        }

        axios.request(options).then((response) => {
            if (response.status >= 400) {
                const status = response.status;
                const message = 'An unexpected error prevented your default RS model to be created';

                if ([400, 401, 403, 404].indexOf(response.status) >= 0) {
                    const parsedResp = response.data;
                    message = parsedResp['exceptionText'];
                }

                callback({
                    status: status,
                    message: message
                });
            } else {
                callback(null, {
                    status: response.status,
                    headers: response.headers,
                    body: response.data
                });
            }
        }).catch((err) => {
            callback({
                status: 504,
                message: 'An unexpected error prevented your default RS model to be created'
            });
        });
    };

    const createDefaultModel = function(userInfo, callback) {
        const defaultModel = {
            aggregatorValue: config.revenueModel,
            ownerValue: 100 - config.revenueModel,
            algorithmType: 'FIXED_PERCENTAGE',
            productClass: 'defaultRevenue',
            providerId: userInfo.partyId
        };

        makeModelsRequest(userInfo, defaultModel, '', callback);
    };

    const retrieveRSModel = function(userInfo, productClass, callback) {
        const query = '?productClass=' + productClass + '&providerId=' + userInfo.id;

        makeModelsRequest(userInfo, null, query, callback);
    };

    return {
        createDefaultModel: createDefaultModel,
        retrieveRSModel: retrieveRSModel
    };
})();

exports.rssClient = rssClient;
