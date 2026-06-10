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

const config = require('../config');
const federation = require('./lib/federation').federation;
const logger = require('../lib/logger').logger.getLogger('FederationMiddleware');

const middleware = (() => {
    const getAPIName = function(apiUrl) {
        return String(apiUrl || '').split('/')[1];
    };

    const isTmforumApi = function(apiName) {
        return Object.keys(config.tmforum || {}).some((tmforumApiName) => {
            return config.tmforum[tmforumApiName].path === apiName;
        });
    };

    const sendError = function(res, err) {
        res.status(err.status || 500);
        res.json({
            error: err.message || 'Error processing federation context'
        });
        res.end();
    };

    const setRequestFederationContext = function(req, res, next) {
        const api = getAPIName(req.apiUrl);

        if (!config.federationEnabled || !isTmforumApi(api)) {
            return next();
        }

        federation.setRequestFederationContextFromApiUrl(req, req.apiUrl)
            .then(() => next())
            .catch((err) => {
                logger.error(`Federation context error: ${err.message}`);
                sendError(res, err);
            });
    };

    return {
        setRequestFederationContext: setRequestFederationContext
    };
})();

exports.middleware = middleware;
