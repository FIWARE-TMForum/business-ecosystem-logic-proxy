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

const slaModel = require('../db/schemas/slaModel');

const slaService = (function () {

    /**
     * Save an SLA for the offering specifed in the request body.
     *
     * @param  {Object} req     Incoming request.
     * @param  {Object} res     Outgoing object.
     */    
    const saveSla = function (req, res) {

        try{
            // Check the request and extract info
            const offerId = JSON.parse(req.body).offerId;
            const description = JSON.parse(req.body).description;
            const services = JSON.parse(req.body).services;

            if (offerId) {

                //Generate and save apiKey
                // var service = new slaService();
                // service.offerId = offerId;
                // service.description = description;
                // service.services = services;
                slaModel.findOneAndUpdate({offerId: offerId},
                    { $set: {offerId: offerId, description: description, services: services}},
                    {new: true, upsert: true})
                .then((rawResp) => {
                    res.status(200).json(rawResp);
                }).catch((err) => {
                    res.status(500).json({error: err.message});
                })
                

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
    const getSla = function (req, res) {

        try{

            // Check the request and extract info
            const offerId = req.params.id
            
            if (offerId) {
                //var service = new slaService();
                //service.appId = appId;
                //service.userId = userId;
                //service.authToken = authToken;
                //service.refreshToken = refreshToken;
                //service.expire = Date.now() + 3600000; //expire; TODO FIX

                slaModel.findOne({offerId: offerId}).then((rawResp) => {
                    res.status(200).json(rawResp);
                }).catch((err) => {
                    res.status(500).json({error: err.message});
                });
            } else {
                res.status(422).json({error: 'offerId missing'});
            }

        } catch (e) {
            res.status(400).json({ error: e.message + ' Invalid body' });
        }
    };

    return {
        saveSla: saveSla,
        getSla: getSla
    };

})();

exports.slaService = slaService;