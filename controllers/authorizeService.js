/* Copyright (c) 2015 - 2018 CoNWeT Lab., Universidad Politécnica de Madrid
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

var AccountingService = require('../db/schemas/accountingService'),
    uuidv4 = require('uuid/v4');

var authorizeService = (function() {
    /**
     * Generates am aìKey.
     */
    var generateApiKey = function() {
        var apiKey = uuidv4();

        return apiKey;
    };

    /**
     * Generates and send an apiKey for the url service specifed in the request body. The apiKey is saved in "uncommitted" state.
     *
     * @param  {Object} req     Incoming request.
     * @param  {Object} res     Outgoing object.
     */

    var getApiKey = function(req, res) {
        try {
            // Check the request and extract the url
            var url = JSON.parse(req.body).url;

            if (url) {
                // Generate and save apiKey
                var apiKey = generateApiKey();
                var service = new AccountingService();
                service.url = url;
                service.apiKey = apiKey;
                service.state = 'UNCOMMITTED';

                service.save(function(err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                    } else {
                        res.status(201).json({ apiKey: apiKey });
                    }
                });
            } else {
                res.status(422).json({ error: 'Url missing' });
            }
        } catch (e) {
            res.status(400).json({ error: 'Invalid body' });
        }
    };

    /**
     * Change the apiKey state to "committed".
     *
     * @param  {Object} req      Incoming request.
     * @param  {Object} res      Outgoing response.
     */
    var commitApiKey = function(req, res) {
        // Update the apiKey state
        var apiKey = req.params.apiKey;

        AccountingService.update({ apiKey: apiKey }, { $set: { state: 'COMMITTED' } }, function(err, rawResp) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else if (rawResp.n < 1) {
                res.status(404).json({ error: 'Invalid API Key' });
            } else {
                res.status(200).send();
            }
        });
    };

    return {
        getApiKey: getApiKey,
        commitApiKey: commitApiKey
    };
})();

exports.authorizeService = authorizeService;
