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
const cron = require('node-cron')
const utils = require('../lib/utils')
const statsSchema = require('../db/schemas/stats')

const logger = require('./../lib/logger').logger.getLogger('TMF')


function stats() {

    const loadStats = async function() {
        // Get the list of launched offering
        const productUrl = utils.getAPIProtocol('catalog') + '://' + utils.getAPIHost('catalog') + ':' + utils.getAPIPort('catalog') + '/productOffering?lifecycleStatus=Launched&fields=name'
        const offers = await axios.request({
            method: 'GET',
            url: productUrl
        })

        // Get the list of organizations
        const partyUrl = utils.getAPIProtocol('party') + '://' + utils.getAPIHost('party') + ':' + utils.getAPIPort('party') + '/organization?fields=tradingName'
        const parties = await axios.request({
            method: 'GET',
            url: partyUrl
        })

        // Save data in MongoDB
        const res = await statsSchema.findOne()
        const services = offers.data.map((off) => {
            return off.name
        })

        const organizations = parties.data.map((part) => {
            return part.tradingName
        })

        if (res) {
            res.services = services
            res.organizations = organizations
            await res.save()
        } else {
            const newStat = new statsSchema()
            newStat.services = services
            newStat.organizations = organizations
            await newStat.save()
        }
    }

    const getStats = function(req, res) {
        statsSchema.findOne().then((result) => {
            res.send(result)
        })
    }

    const init = function() {
        return loadStats()
        .catch((err) => {
            console.log(err)
            logger.error('Stats could not be loaded')
        })
        .finally(() => {
            cron.schedule('0 3 * * *', loadStats);
        })
    }

    return {
        getStats: getStats,
        init: init
    }
}

exports.stats = stats
