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
const config = require('../config')

const logger = require('./../lib/logger').logger.getLogger('TMF')

const LIFECYCLE_STATUSES = ['Active', 'Launched', 'Retired', 'Obsolete']
const PROVIDER_STATS_RESOURCES = [
    { key: 'productOffering', api: 'catalog', path: '/productOffering' },
    { key: 'catalog', api: 'catalog', path: '/catalog' },
    { key: 'productSpecification', api: 'catalog', path: '/productSpecification' },
    { key: 'serviceSpecification', api: 'service', path: '/serviceSpecification' },
    { key: 'resourceSpecification', api: 'resource', path: '/resourceSpecification' },
    { key: 'usageSpecification', api: 'usage', path: '/usageSpecification' }
]


function stats() {

    const getAPIBaseUrl = function(api) {
        return utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + utils.getAPIPath(api)
    }

    const getProviderStatsUrl = function(resource, organizationId) {
        return getAPIBaseUrl(resource.api) + resource.path + '?relatedParty.id=' + encodeURIComponent(organizationId) + '&fields=lifecycleStatus'
    }

    const getEmptyLifecycleStats = function() {
        return LIFECYCLE_STATUSES.reduce((stats, status) => {
            stats[status] = 0
            return stats
        }, {})
    }

    const countLifecycleStatuses = function(items) {
        const result = getEmptyLifecycleStats()

        items.forEach((item) => {
            const status = LIFECYCLE_STATUSES.find((validStatus) => {
                return String(item.lifecycleStatus || '').toLowerCase() === validStatus.toLowerCase()
            })

            if (status != null) {
                result[status] += 1
            }
        })

        return result
    }

    const getItem = async function (url) {
        const response = await axios.request({
            method: 'GET',
            url: url
        })

        return response.data
    }

    const pageData = async function(baseUrl, mapper) {
        let start = 0
        let limit = 50
        let complete = false
        let data = []

        while (!complete) {
            let productUrl = baseUrl + `&offset=${start}&limit=${limit}`
            let response

            try {
                response = await axios.request({
                    method: 'GET',
                    url: productUrl
                })
            } catch (err) {
                const status = err.response?.status;
                const reason = err.response?.data?.message || err.response?.statusText;
                logger.error(
                    `Error loading stats page ${productUrl}` +
                    (status ? ` (HTTP ${status}${reason ? `: ${reason}` : ''})` : '') +
                    `: ${err.message}`
                );
                return null
            }

            if (response.data.length == 0) {
                complete = true
            }

            data = data.concat(response.data.map(mapper))
            start += limit
        }
        return data
    }

    const loadStats = async function() {
        // Get the list of launched offering
        const products = new Set()

        const productBaseUrl = utils.getAPIProtocol('catalog') + '://' + utils.getAPIHost('catalog') + ':' + utils.getAPIPort('catalog') + utils.getAPIPath('catalog') + '/productOffering?lifecycleStatus=Launched&fields=name,productSpecification'
        const offers = await pageData(productBaseUrl, (off) => {
            if (off.productSpecification) {
                products.add(off.productSpecification.id)
            }

            return off.name
        })

        if (offers == null) {
            logger.error('Stats refresh skipped: product offering pages could not be loaded');
            return
        }

        // The products array now has the list of product specifications launched
        // Get the list of product owners
        const partyIds = new Set()
        for (const prodId of products) {
            const productUrl = utils.getAPIProtocol('catalog') + '://' + utils.getAPIHost('catalog') + ':' + utils.getAPIPort('catalog') + utils.getAPIPath('catalog') + `/productSpecification/${prodId}?fields=relatedParty`

            try {
                const product = await getItem(productUrl)

                if (product.relatedParty) {
                    product.relatedParty.forEach((party) => {
                        if ((party.role || '').toLowerCase() == config.roles.seller.toLowerCase()) {
                            partyIds.add(party.id)
                        }
                    })
                }
            } catch (err) {
                const status = err.response?.status;
                const reason = err.response?.data?.message || err.response?.statusText;
                logger.error(
                    `Error getting product specification ${prodId}` +
                    (status ? ` (HTTP ${status}${reason ? `: ${reason}` : ''})` : '') +
                    `: ${err.message}`
                );
                continue;
            }
        }

        // Get the list of organizations
        const partyBaseUrl = utils.getAPIProtocol('party') + '://' + utils.getAPIHost('party') + ':' + utils.getAPIPort('party') + utils.getAPIPath('party') + '/organization?fields=tradingName'
        let parties = await pageData(partyBaseUrl, (part) => {
            return {
                id: part.id,
                name: part.tradingName
            }
        })

        if (parties == null) {
            logger.error('Stats refresh skipped: organization pages could not be loaded');
            return
        }

        // Filter only the parties that own launched products
        parties = parties.filter((part) => partyIds.has(part.id)).map((part) => part.name)

        // Save data in MongoDB
        const res = await statsSchema.findOne()

        if (res) {
            res.services = offers
            res.organizations = parties
            await res.save()
        } else {
            const newStat = new statsSchema()
            newStat.services = offers
            newStat.organizations = parties
            await newStat.save()
        }
    }

    const getStats = function(req, res) {
        statsSchema.findOne().then((result) => {
            res.send(result)
        })
    }

    const getProviderStats = async function(req, res) {
        const organizationId = req.params.organizationId

        try {
            const results = await Promise.all(PROVIDER_STATS_RESOURCES.map(async (resource) => {
                const items = await pageData(getProviderStatsUrl(resource, organizationId), (item) => item)

                if (items == null) {
                    throw new Error(`Provider stats resource ${resource.key} could not be loaded`)
                }

                return {
                    key: resource.key,
                    stats: countLifecycleStatuses(items)
                }
            }))

            const responseBody = results.reduce((stats, result) => {
                stats[result.key] = result.stats
                return stats
            }, {})

            res.send(responseBody)
        } catch (err) {
            const status = err.response?.status;
            const reason = err.response?.data?.message || err.response?.statusText;
            logger.error(
                `Error loading provider stats for organization ${organizationId}` +
                (status ? ` (HTTP ${status}${reason ? `: ${reason}` : ''})` : '') +
                `: ${err.message}`
            );

            res.status(500).send({
                message: 'Provider stats could not be loaded'
            })
        }
    }

    const setupCron = function() {
        const scheduledTasks = cron.getTasks();

        if (!scheduledTasks.has("stats-cron")) {
            cron.schedule('0 3 * * *', () => {
                loadStats().catch((err) => logger.error('Stats cron refresh failed', err));
            }, { name: "stats-cron" });
        }
    }

    const init = function() {
        setupCron();

        return loadStats().catch((err) => {
            logger.error('Stats could not be loaded', err);
        });
    }

    return {
        getStats: getStats,
        getProviderStats: getProviderStats,
        init: init
    }
}

exports.stats = stats
