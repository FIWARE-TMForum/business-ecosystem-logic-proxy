/* Contributed by Digital Catapult
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

const reputationModel = require('../db/schemas/reputationModel');

const reputationService = (function () {

    /**
     * Save a rate for the offering specifed in the request body.
     *
     * @param  {Object} req     Incoming request.
     * @param  {Object} res     Outgoing object.
     */    
    const saveReputation = function (req, res) {

        try{
            // Check the request and extract info
            const offerId = JSON.parse(req.body).offerId;
            const consumerId = JSON.parse(req.body).consumerId;
            const rate = JSON.parse(req.body).rate;
            const description = JSON.parse(req.body).description;

            if (offerId && consumerId && rate) {
                reputationModel.findOneAndUpdate(
                    {offerId: offerId, consumerId : consumerId},
                    { $set: {offerId: offerId, consumerId: consumerId, rate: rate, description : description}},
                    {new: true, upsert: true})
                .then((rawResp) => {
                    res.status(200).json(rawResp);
                }).catch((err) => {
                    res.status(500).json({error: err.message});
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
    const getOverallReputation = function (req, res) {
        try{   
            reputationModel.aggregate([{$group:{_id:"$offerId",avg:{$avg: "$rate"}, count:{$sum:1}}}]).then((resp) => {
                res.status(200).json(resp);
            }).catch((err) => {
                res.status(500).json({error: err.message});
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
    const getReputation = function (req, res) {

        try{
            // Check the request and extract info
            const offerId = req.params.id;
            const consumerId = req.params.consumerId;
            
            if (offerId && consumerId) {
                reputationModel.find({offerId:offerId, consumerId:consumerId}).then((resp) => {
                    if(resp[0] === undefined)
                        //calculate and return overall score
                        res.status(200).json({});
                    else
                        res.status(200).json(resp[0]);
                }).catch((err) => {
                    res.status(500).json({error: err.message});
                });
            } else {
                res.status(422).json({error: 'Some fields missing'});
            }

        } catch (e) {
            res.status(400).json({ error: e.message + ' Invalid request' });
        }
    };

    return {
        saveReputation: saveReputation,
        getOverallReputation: getOverallReputation,
        getReputation: getReputation,
    };

})();

exports.reputationService = reputationService;