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

var reputationModel = require('../db/schemas/reputationModel'),
     config = require('../config'),
     uuid = require('node-uuid');

var reputationService = (function () {

    /**
     * Save a rate for the offering specifed in the request body.
     *
     * @param  {Object} req     Incoming request.
     * @param  {Object} res     Outgoing object.
     */    
    var saveReputation = function (req, res) {

        try{
            // Check the request and extract info
            var offerId = JSON.parse(req.body).offerId;
            var consumerId = JSON.parse(req.body).consumerId;
            var rate = JSON.parse(req.body).rate;
            var description = JSON.parse(req.body).description;

            if (offerId && consumerId && rate) {
                reputationModel.findOneAndUpdate({offerId: offerId, consumerId : consumerId}, { $set: {offerId: offerId, consumerId: consumerId, rate: rate, description : description}}, {new: true, upsert: true}, function (err, rawResp) {
                    if (err) {
                        res.status(500).json({error: err.message}); 
                    } 
                    else {
                        res.status(200).json(rawResp);
                    }
                }); 
            } else {
                res.status(422).json({error: 'Some fields missing'});
            }

        } catch (e) {
            res.status(400).json({ error: e.message + ' Invalid body' });
        }
    };


     /**
     * Retrieve reputation score (avg) and number of rating (count) for all the offering.
     *
     * @param  {Object} req     Incoming request.
     * @param  {Object} res     Outgoing object.
     */    
    var getOverallReputation = function (req, res) {
        try{   
            reputationModel.aggregate({$group:{_id:"$offerId",avg:{$avg: "$rate"}, count:{$sum:1}}}, function (err, resp) {
                if (err) {
                    res.status(500).json({error: err.message});
                } 
                else {
                    //calculate and return overall score
                    res.status(200).json(resp);
                }
            });
        } catch (e) {
            res.status(400).json({ error: e.message + ' Invalid request' });
        }
    };

    /**
     * Retrieve reputation score for the offerId and userId specifed in the request body.
     *
     * @param  {Object} req     Incoming request.
     * @param  {Object} res     Outgoing object.
     */    
    var getReputation = function (req, res) {

        try{

            // Check the request and extract info
            var offerId = req.params.id;
            var consumerId = req.params.consumerId;
            
            if (offerId && consumerId) {
                reputationModel.find({offerId:offerId, consumerId:consumerId}, function (err, resp) {
                    if (err) {
                        res.status(500).json({error: err.message});
                    } 
                    else {
                        //calculate and return overall score
                        res.status(200).json(resp);
                    }
                });
            } else {
                res.status(422).json({error: 'Some fields missing'});
            }

        } catch (e) {
            res.status(400).json({ error: e.message + ' Invalid request' });
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
        saveReputation: saveReputation,
        getOverallReputation: getOverallReputation,
        getReputation: getReputation,
    };

})();

exports.reputationService = reputationService;