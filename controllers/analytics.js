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

const axios = require('axios')
const config = require('../config')
const utils = require('../lib/utils')

const logger = require('./../lib/logger').logger.getLogger('Analytics')

function analytics() {
    const VALID_TABS = ['businessInsights', 'usageMonitor']

    const normalizeNonEmptyString = function(value) {
        if (typeof value !== 'string') {
            return null
        }

        const normalized = value.trim()
        return normalized.length > 0 ? normalized : null
    }

    const makeSupersetRequest = async function(method, path, data, headers) {
        const requestPath = path.charAt(0) === '/' ? path : `/${path}`
        const response = await axios.request({
            method: method,
            url: `${config.analyticsSuperset.url.replace(/\/+$/, '')}${requestPath}`,
            data: data,
            headers: headers
        })

        return response
    }

    const createGuestToken = async function(req, dashboardId) {
        const response = await makeSupersetRequest(
            'POST',
            config.analyticsSuperset.guestTokenPath,
            {
                dashboard: dashboardId
            },
            {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${req.user.accessToken}`
            }
        )

        return response.data.token
    }

    const validateRequest = function(req) {
        if (config.analyticsEnabled !== true) {
            return {
                status: 403,
                error: 'Analytics is disabled'
            }
        }

        let body
        try {
            body = JSON.parse(req.body)
        } catch (e) {
            return {
                status: 400,
                error: 'Invalid body'
            }
        }

        const tab = normalizeNonEmptyString(body.tab)

        if (!tab || VALID_TABS.indexOf(tab) < 0) {
            return {
                status: 400,
                error: 'A valid tab is required'
            }
        }

        if (tab === 'usageMonitor' && !utils.hasRole(req.user, config.roles.admin)) {
            return {
                status: 403,
                error: 'You are not authorized to access Usage Monitor'
            }
        }

        let dashboardKey
        if (tab === 'usageMonitor') {
            dashboardKey = 'usageMonitor'
        } else {
            dashboardKey = utils.hasRole(req.user, config.roles.orgAdmin) ? 'businessInsightsLear' : 'businessInsightsNonLear'
        }

        const dashboardId = normalizeNonEmptyString(config.analyticsDashboards[dashboardKey])

        if (!dashboardId) {
            return {
                status: 500,
                error: 'Analytics dashboard is not configured'
            }
        }

        if (
            !normalizeNonEmptyString(config.analyticsSuperset.url) ||
            !normalizeNonEmptyString(config.analyticsSuperset.guestTokenPath)
        ) {
            return {
                status: 500,
                error: 'Analytics service is not configured'
            }
        }

        return {
            dashboardId: dashboardId
        }
    }

    const getGuestToken = async function(req, res) {
        const validation = validateRequest(req)

        if (validation.error) {
            return res.status(validation.status).json({ error: validation.error })
        }

        try {
            const token = await createGuestToken(req, validation.dashboardId)

            if (!token) {
                return res.status(502).json({ error: 'Superset guest token not found in response' })
            }

            return res.status(200).json({
                dashboardId: validation.dashboardId,
                token: token
            })
        } catch (err) {
            if (err.status) {
                return res.status(err.status).json({ error: err.message })
            }

            const status = err.response ? err.response.status : null
            const message = status ? `Superset guest token request failed with HTTP ${status}` : err.message
            logger.error(message)
            return res.status(502).json({ error: 'It was not possible to generate the analytics guest token' })
        }
    }

    return {
        getGuestToken: getGuestToken
    }
}

exports.analytics = analytics
