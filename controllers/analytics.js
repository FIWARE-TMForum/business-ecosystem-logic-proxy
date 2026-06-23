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
const partyClient = require('../lib/party').partyClient

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

    const collectCookies = function(cookieStore, response) {
        const setCookie = response.headers ? response.headers['set-cookie'] : null
        if (!Array.isArray(setCookie)) {
            return
        }

        setCookie.forEach((cookie) => {
            const cookiePair = cookie.split(';')[0]
            const separator = cookiePair.indexOf('=')
            if (separator > 0) {
                cookieStore[cookiePair.substring(0, separator)] = cookiePair.substring(separator + 1)
            }
        })
    }

    const buildCookieHeader = function(cookieStore) {
        return Object.keys(cookieStore).map((name) => {
            return `${name}=${cookieStore[name]}`
        }).join('; ')
    }

    const makeSupersetRequest = async function(method, path, data, headers, cookieStore) {
        const requestHeaders = Object.assign({}, headers)
        const cookieHeader = buildCookieHeader(cookieStore)
        if (cookieHeader.length > 0) {
            requestHeaders.Cookie = cookieHeader
        }

        const response = await axios.request({
            method: method,
            url: `${config.analyticsSuperset.url.replace(/\/+$/, '')}${path}`,
            data: data,
            headers: requestHeaders
        })

        collectCookies(cookieStore, response)
        return response
    }

    const getAccessToken = async function(cookieStore) {
        const response = await makeSupersetRequest(
            'POST',
            '/api/v1/security/login',
            {
                username: config.analyticsSuperset.username,
                password: config.analyticsSuperset.password,
                provider: config.analyticsSuperset.provider
            },
            {
                'Content-Type': 'application/json'
            },
            cookieStore
        )

        return response.data.access_token
    }

    const getCsrfToken = async function(accessToken, cookieStore) {
        const response = await makeSupersetRequest(
            'GET',
            '/api/v1/security/csrf_token/',
            null,
            {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`
            },
            cookieStore
        )

        return response.data.result
    }

    const getOrganizationVat = function(organization) {
        const externalReference = (organization.externalReference || []).find((ref) => {
            return (ref.externalReferenceType || '').toLowerCase() === 'idm_id'
        })

        if (externalReference) {
            return externalReference.name
        }

        const organizationIdentification = (organization.organizationIdentification || []).find((identifier) => {
            return identifier.identificationId
        })

        if (organizationIdentification) {
            return organizationIdentification.identificationId
        }

        return ''
    }

    const resolveOrganizationVat = async function(req) {
        if (!req.user.userId || !req.user.partyId) {
            throw {
                status: 403,
                message: 'An organization must be selected to access analytics dashboards'
            }
        }

        let organization
        try {
            organization = (await partyClient.getOrganization(req.user.partyId)).body
        } catch (err) {
            throw {
                status: 403,
                message: 'It was not possible to resolve the selected organization'
            }
        }

        const vat = normalizeNonEmptyString(getOrganizationVat(organization))
        if (!vat) {
            throw {
                status: 403,
                message: 'The selected organization does not have a VAT identifier'
            }
        }

        return vat
    }

    const renderTemplate = function(template, vat) {
        return template.replace(/\{\{\s*vat\s*\}\}/g, vat.replace(/'/g, "''"))
    }

    const buildRlsRules = async function(req, rlsKey) {
        const rules = config.analyticsSuperset.rls[rlsKey]
        const vat = await resolveOrganizationVat(req)

        return rules.reduce((result, rule) => {
            rule.datasets.forEach((dataset) => {
                result.push({
                    dataset: dataset,
                    clause: renderTemplate(rule.clauseTemplate, vat)
                })
            })

            return result
        }, [])
    }

    const createGuestToken = async function(req, dashboardId, rlsKey) {
        const rlsRules = await buildRlsRules(req, rlsKey)
        const cookieStore = {}
        const accessToken = await getAccessToken(cookieStore)

        if (!accessToken) {
            throw new Error('Superset access token not found in login response')
        }

        const csrfToken = await getCsrfToken(accessToken, cookieStore)

        if (!csrfToken) {
            throw new Error('Superset CSRF token not found in response')
        }

        const payload = {
            user: {
                username: 'embedded.user'
            },
            resources: [
                {
                    type: 'dashboard',
                    id: dashboardId
                }
            ],
            rls: rlsRules
        }

        const response = await makeSupersetRequest(
            'POST',
            '/api/v1/security/guest_token/',
            payload,
            {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'X-CSRFToken': csrfToken,
                Referer: config.analyticsSuperset.url.replace(/\/+$/, '')
            },
            cookieStore
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
            !normalizeNonEmptyString(config.analyticsSuperset.username) ||
            !normalizeNonEmptyString(config.analyticsSuperset.password) ||
            !normalizeNonEmptyString(config.analyticsSuperset.provider)
        ) {
            return {
                status: 500,
                error: 'Analytics service is not configured'
            }
        }

        return {
            dashboardId: dashboardId,
            rlsKey: dashboardKey
        }
    }

    const getGuestToken = async function(req, res) {
        const validation = validateRequest(req)

        if (validation.error) {
            return res.status(validation.status).json({ error: validation.error })
        }

        try {
            const token = await createGuestToken(req, validation.dashboardId, validation.rlsKey)

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
