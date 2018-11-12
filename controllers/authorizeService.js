/* Copyright (c) 2015 - 2018 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the bae-logic-proxy-test of the
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

var accessTokenService = require('../db/schemas/accessTokenService'),
     config = require('../config'),
     uuid = require('node-uuid');

var authorizeService = (function () {

    // /**
    //  * Generates am aìKey.
    //  */
    // var generateApiKey = function () {
    //     var apiKey = uuid.v4();

    //     return apiKey;
    // };

    /**
     * Save an OAuth2 token for the app and user specifed in the request body.
     *
     * @param  {Object} req     Incoming request.
     * @param  {Object} res     Outgoing object.
     */    
    var saveAppToken = function (req, res) {

        try{

            // Check the request and extract info
            var appId = JSON.parse(req.body).appId;
            var userId = JSON.parse(req.body).userId;
            var authToken = JSON.parse(req.body).authToken;
            var refreshToken = JSON.parse(req.body).refreshToken;
            var expire = JSON.parse(req.body).expire;

            if (appId) {

                //Generate and save apiKey
                var service = new accessTokenService();
                service.appId = appId;
                service.userId = userId;
                service.authToken = authToken;
                service.refreshToken = refreshToken;
                service.expire = Date.now() + (parseInt(expire) * 1000); 

                accessTokenService.findOneAndUpdate({appId: appId, userId: userId}, { $set: {appId: appId, userId: userId, authToken: authToken, refreshToken: refreshToken, expire: service.expire}}, {upsert: true}, function (err, rawResp) {
                    if (err) {
                        res.status(500).json({error: err.message}); 
                    } 
                    else {
                        res.status(200).json(rawResp);
                    }
                });
                

            } else {
                res.status(422).json({error: 'AppId missing'});
            }

        } catch (e) {
            res.status(400).json({ error: e.message + ' Invalid body' });
        }
    };


        /**
     * Save an OAuth2 token for the app and user specifed in the request body.
     *
     * @param  {Object} req     Incoming request.
     * @param  {Object} res     Outgoing object.
     */    
    var getAppToken = function (req, res) {

        try{

            // Check the request and extract info
            var appId = JSON.parse(req.body).appId;
            var userId = JSON.parse(req.body).userId;
            
            if (appId) {

                // Generate and save apiKey
                var service = new accessTokenService();
                service.appId = appId;
                service.userId = userId;
                //service.authToken = authToken;
                //service.refreshToken = refreshToken;
                //service.expire = Date.now() + 3600000; //expire; TODO FIX

                accessTokenService.findOne({appId: appId, userId: userId}, function (err, rawResp) {
                    if (err) {
                        res.status(500).json({error: err.message});
                    } 
                    else {
                        //res.status(200).json({appId: appId, userId: userId, authToken: JSON.parse(rawResp).authToken, refreshToken: JSON.parse(rawResp).refreshToken, expire: JSON.parse(rawResp).expire});
                        res.status(200).json(rawResp);
                    }
                });
                

            } else {
                res.status(422).json({error: 'AppId missing'});
            }

        } catch (e) {
            res.status(400).json({ error: e.message + ' Invalid body' });
        }
    };

    // /**
    //  * Change the apiKey state to "committed".
    //  *
    //  * @param  {Object} req      Incoming request.
    //  * @param  {Object} res      Outgoing response.
    //  */
    // var commitApiKey = function (req, res) {

    //     // Update the apiKey state
    //     var apiKey = req.params.apiKey;

    //     AccountingService.update({appId: appId, userId: userId}, { $set: {authToken: authToken, refreshToken: refreshToken, expire: expire}}, function (err, rawResp) {
    //         if (err) {
    //             res.status(500).json({error: err.message});
    //         } else if (rawResp.n < 1) {
    //             res.status(404).json({error: 'Invalid API Key'});
    //         } else {
    //             res.status(200).send();
    //         }
    //     });
    // };

    return {
        saveAppToken: saveAppToken,
        getAppToken: getAppToken
    };

})();

exports.authorizeService = authorizeService;
