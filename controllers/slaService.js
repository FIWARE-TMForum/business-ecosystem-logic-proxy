/* Copyright (c) 2018 Digital Catapult
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

var slaModel = require('../db/schemas/slaModel'),
     config = require('../config'),
     uuid = require('node-uuid');

var slaService = (function () {

    /**
     * Save an SLA for the offering specifed in the request body.
     *
     * @param  {Object} req     Incoming request.
     * @param  {Object} res     Outgoing object.
     */    
    var saveSla = function (req, res) {

        try{
            // Check the request and extract info
            var offerId = JSON.parse(req.body).offerId;
            var description = JSON.parse(req.body).description;
            var services = JSON.parse(req.body).services;

            if (offerId) {

                //Generate and save apiKey
                // var service = new slaService();
                // service.offerId = offerId;
                // service.description = description;
                // service.services = services;
                slaModel.findOneAndUpdate({offerId: offerId}, { $set: {offerId: offerId, description: description, services: services}}, {new: true, upsert: true}, function (err, rawResp) {
                    if (err) {
                        res.status(500).json({error: err.message}); 
                    } 
                    else {
                        res.status(200).json(rawResp);
                    }
                });
                

            } else {
                res.status(422).json({error: 'offerId missing'});
            }

        } catch (e) {
            res.status(400).json({ error: e.message + ' Invalid body' });
        }
    };


        /**
     * Retrieve an SLA for the offerId specifed in the request body.
     *
     * @param  {Object} req     Incoming request.
     * @param  {Object} res     Outgoing object.
     */    
    var getSla = function (req, res) {

        try{

            // Check the request and extract info
            var offerId = req.params.id
            
            if (offerId) {
                //var service = new slaService();
                //service.appId = appId;
                //service.userId = userId;
                //service.authToken = authToken;
                //service.refreshToken = refreshToken;
                //service.expire = Date.now() + 3600000; //expire; TODO FIX

                slaModel.findOne({offerId: offerId}, function (err, rawResp) {
                    if (err) {
                        res.status(500).json({error: err.message});
                    } 
                    else {
                        //res.status(200).json({appId: appId, userId: userId, authToken: JSON.parse(rawResp).authToken, refreshToken: JSON.parse(rawResp).refreshToken, expire: JSON.parse(rawResp).expire});
                        res.status(200).json(rawResp);
                    }
                });
            } else {
                res.status(422).json({error: 'offerId missing'});
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
        saveSla: saveSla,
        getSla: getSla
    };

})();

exports.slaService = slaService;