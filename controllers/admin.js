/* Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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
const config = require('./../config')
const utils = require('./../lib/utils')
const uuidv4 = require('uuid').v4
const { indexes } = require('./../lib/indexes')

const logger = require('./../lib/logger').logger.getLogger('Admin')

const SEARCH_FILTERS_COLLECTION = 'config'
const SEARCH_FILTERS_CONFIG_ID = 'search-filters'
const FEATURE_FLAGS_COLLECTION = 'config'
const FEATURE_FLAGS_CONFIG_ID = 'feature-flags'
const ANALYTICS_CONFIG_COLLECTION = 'config'
const ANALYTICS_CONFIG_ID = 'analytics'
const FEATURE_FLAGS = [
    'purchaseEnabled',
    'dataSpaceEnabled',
    'quotesEnabled',
    'tenderingEnabled',
    'launchValidationEnabled',
    'aiEnabled',
    'tenderDevButtonsOpenCloseEnabled'
]

function admin() {
    const parseBody = function(body) {
        if (body == null) {
            throw new Error('Invalid body')
        }

        if (typeof body === 'string') {
            return JSON.parse(body)
        }

        if (typeof body === 'object' && !Array.isArray(body)) {
            return body
        }

        throw new Error('Invalid body')
    }

    const normalizeNonEmptyString = function(value) {
        if (typeof value !== 'string') {
            return null
        }

        const normalized = value.trim()
        return normalized.length > 0 ? normalized : null
    }

    const getDefaultSearchFilters = function() {
        return {
            primaryCategoriesMode: 'catalogFirstLevel',
            primaryRootName: '',
            filters: []
        }
    }

    const getDefaultFeatureFlags = function() {
        return FEATURE_FLAGS.reduce((features, feature) => {
            features[feature] = config[feature] === true
            return features
        }, {})
    }

    const normalizeFeatureFlagOverrides = function(features) {
        if (features == null || typeof features !== 'object' || Array.isArray(features)) {
            return {}
        }

        return FEATURE_FLAGS.reduce((overrides, feature) => {
            if (typeof features[feature] === 'boolean') {
                overrides[feature] = features[feature]
            }
            return overrides
        }, {})
    }

    const getEffectiveFeatureFlags = function(overrides) {
        return Object.assign(getDefaultFeatureFlags(), normalizeFeatureFlagOverrides(overrides))
    }

    const applyFeatureFlags = function(features) {
        FEATURE_FLAGS.forEach((feature) => {
            config[feature] = features[feature]
        })

        return features
    }

    const clone = function(value) {
        return JSON.parse(JSON.stringify(value))
    }

    const getAnalyticsConfigResponse = function() {
        return {
            analyticsEnabled: config.analyticsEnabled === true,
            analyticsSupersetDomain: config.analyticsSupersetDomain,
            analyticsDashboards: clone(config.analyticsDashboards),
            analyticsSuperset: {
                url: config.analyticsSuperset.url,
                username: config.analyticsSuperset.username,
                provider: config.analyticsSuperset.provider,
                passwordConfigured: normalizeNonEmptyString(config.analyticsSuperset.password) != null,
                rls: clone(config.analyticsSuperset.rls)
            }
        }
    }

    const applyAnalyticsConfig = function(analyticsConfig) {
        config.analyticsEnabled = analyticsConfig.analyticsEnabled
        config.analyticsSupersetDomain = analyticsConfig.analyticsSupersetDomain
        config.analyticsDashboards = clone(analyticsConfig.analyticsDashboards)
        config.analyticsSuperset = clone(analyticsConfig.analyticsSuperset)

        return getAnalyticsConfigResponse()
    }

    const validateAnalyticsRlsRule = function(rule, path, errors) {
        if (rule == null || typeof rule !== 'object' || Array.isArray(rule)) {
            errors.push(`${path} must be an object`)
            return null
        }

        if (!Array.isArray(rule.datasets) || rule.datasets.length === 0) {
            errors.push(`${path}.datasets must be a non-empty array`)
        }

        const clauseTemplate = normalizeNonEmptyString(rule.clauseTemplate)
        if (clauseTemplate == null) {
            errors.push(`${path}.clauseTemplate is required and must be non-empty`)
        }

        if (!Array.isArray(rule.datasets) || clauseTemplate == null) {
            return null
        }

        const datasets = rule.datasets.filter((dataset, index) => {
            const isValid = Number.isInteger(dataset)
            if (!isValid) {
                errors.push(`${path}.datasets[${index}] must be an integer`)
            }
            return isValid
        })

        return {
            datasets: datasets,
            clauseTemplate: clauseTemplate
        }
    }

    const validateAnalyticsRls = function(rls, errors) {
        const requiredKeys = ['businessInsightsNonLear', 'businessInsightsLear', 'usageMonitor']

        if (rls == null || typeof rls !== 'object' || Array.isArray(rls)) {
            errors.push('analyticsSuperset.rls must be an object')
            return null
        }

        const normalized = {}
        requiredKeys.forEach((key) => {
            if (!Array.isArray(rls[key])) {
                errors.push(`analyticsSuperset.rls.${key} must be an array`)
                return
            }

            normalized[key] = rls[key].map((rule, index) => {
                return validateAnalyticsRlsRule(rule, `analyticsSuperset.rls.${key}[${index}]`, errors)
            }).filter((rule) => rule != null)
        })

        return normalized
    }

    const validateAndNormalizeAnalyticsConfig = function(body, currentPassword) {
        const errors = []

        if (body == null || typeof body !== 'object' || Array.isArray(body)) {
            return {
                errors: ['Body must be a JSON object'],
                value: null
            }
        }

        if (typeof body.analyticsEnabled !== 'boolean') {
            errors.push('analyticsEnabled is required and must be a boolean')
        }

        const analyticsSupersetDomain = normalizeNonEmptyString(body.analyticsSupersetDomain)
        if (analyticsSupersetDomain == null) {
            errors.push('analyticsSupersetDomain is required and must be non-empty')
        }

        if (body.analyticsDashboards == null || typeof body.analyticsDashboards !== 'object' || Array.isArray(body.analyticsDashboards)) {
            errors.push('analyticsDashboards must be an object')
        }

        const dashboardKeys = ['businessInsightsNonLear', 'businessInsightsLear', 'usageMonitor']
        const analyticsDashboards = {}
        if (body.analyticsDashboards != null && typeof body.analyticsDashboards === 'object' && !Array.isArray(body.analyticsDashboards)) {
            dashboardKeys.forEach((key) => {
                const dashboardId = normalizeNonEmptyString(body.analyticsDashboards[key])
                if (dashboardId == null) {
                    errors.push(`analyticsDashboards.${key} is required and must be non-empty`)
                } else {
                    analyticsDashboards[key] = dashboardId
                }
            })
        }

        if (body.analyticsSuperset == null || typeof body.analyticsSuperset !== 'object' || Array.isArray(body.analyticsSuperset)) {
            errors.push('analyticsSuperset must be an object')
        }

        let analyticsSuperset = null
        if (body.analyticsSuperset != null && typeof body.analyticsSuperset === 'object' && !Array.isArray(body.analyticsSuperset)) {
            const url = normalizeNonEmptyString(body.analyticsSuperset.url)
            const username = normalizeNonEmptyString(body.analyticsSuperset.username)
            const password = normalizeNonEmptyString(body.analyticsSuperset.password) || normalizeNonEmptyString(currentPassword)
            const provider = normalizeNonEmptyString(body.analyticsSuperset.provider)
            const rls = validateAnalyticsRls(body.analyticsSuperset.rls, errors)

            if (url == null) {
                errors.push('analyticsSuperset.url is required and must be non-empty')
            }
            if (username == null) {
                errors.push('analyticsSuperset.username is required and must be non-empty')
            }
            if (password == null) {
                errors.push('analyticsSuperset.password is required and must be non-empty')
            }
            if (provider == null) {
                errors.push('analyticsSuperset.provider is required and must be non-empty')
            }

            analyticsSuperset = {
                url: url,
                username: username,
                password: password,
                provider: provider,
                rls: rls
            }
        }

        if (errors.length > 0) {
            return { errors: errors, value: null }
        }

        return {
            errors: [],
            value: {
                analyticsEnabled: body.analyticsEnabled,
                analyticsSupersetDomain: analyticsSupersetDomain,
                analyticsDashboards: analyticsDashboards,
                analyticsSuperset: analyticsSuperset
            }
        }
    }

    const validateAndNormalizeFeatureFlags = function(body) {
        const errors = []

        if (body == null || typeof body !== 'object' || Array.isArray(body)) {
            return {
                errors: ['Body must be a JSON object'],
                value: null
            }
        }

        const keys = Object.keys(body)
        if (keys.length === 0) {
            errors.push('At least one feature flag is required')
        }

        const normalized = {}
        keys.forEach((key) => {
            if (FEATURE_FLAGS.indexOf(key) === -1) {
                errors.push(`${key} is not a configurable feature flag`)
                return
            }

            if (typeof body[key] !== 'boolean') {
                errors.push(`${key} must be a boolean`)
                return
            }

            normalized[key] = body[key]
        })

        if (errors.length > 0) {
            return { errors: errors, value: null }
        }

        return {
            errors: [],
            value: normalized
        }
    }

    const validateOption = function(option, filterName, optionIndex, errors) {
        if (option == null || typeof option !== 'object' || Array.isArray(option)) {
            errors.push(`filters[${filterName}].children[${optionIndex}] must be an object`)
            return null
        }

        if ('source' in option) {
            errors.push(`filters[${filterName}].children[${optionIndex}] must not include source`)
        }
        if ('rootName' in option) {
            errors.push(`filters[${filterName}].children[${optionIndex}] must not include rootName`)
        }
        if ('children' in option) {
            errors.push(`filters[${filterName}].children[${optionIndex}] must not include nested children`)
        }

        const name = normalizeNonEmptyString(option.name)
        if (name == null) {
            errors.push(`filters[${filterName}].children[${optionIndex}].name is required and must be non-empty`)
        }

        if ('label' in option && typeof option.label !== 'string') {
            errors.push(`filters[${filterName}].children[${optionIndex}].label must be a string`)
        }

        if (name == null) {
            return null
        }

        const normalizedOption = {
            name: name
        }

        if (typeof option.label === 'string') {
            normalizedOption.label = option.label
        }

        return normalizedOption
    }

    const validateFilter = function(filter, index, errors) {
        if (filter == null || typeof filter !== 'object' || Array.isArray(filter)) {
            errors.push(`filters[${index}] must be an object`)
            return null
        }

        const name = normalizeNonEmptyString(filter.name)
        if (name == null) {
            errors.push(`filters[${index}].name is required and must be non-empty`)
        }

        if ('label' in filter && typeof filter.label !== 'string') {
            errors.push(`filters[${index}].label must be a string`)
        }

        const source = filter.source
        if (source !== 'configured' && source !== 'categoryRoot') {
            errors.push(`filters[${index}].source must be one of: configured, categoryRoot`)
        }

        let normalizedChildren = []
        if (source === 'configured') {
            if ('children' in filter && !Array.isArray(filter.children)) {
                errors.push(`filters[${index}].children must be an array`)
            } else if (Array.isArray(filter.children)) {
                normalizedChildren = filter.children.map((option, optionIndex) => {
                    return validateOption(option, index, optionIndex, errors)
                }).filter((option) => option != null)
            }
        } else if (source === 'categoryRoot') {
            const rootName = normalizeNonEmptyString(filter.rootName)

            if (rootName == null) {
                errors.push(`filters[${index}].rootName is required and must be non-empty when source is categoryRoot`)
            }

            if ('children' in filter) {
                if (!Array.isArray(filter.children)) {
                    errors.push(`filters[${index}].children must be an array when provided`)
                } else if (filter.children.length > 0) {
                    errors.push(`filters[${index}].children must be empty when source is categoryRoot`)
                }
            }
        }

        if (name == null || (source !== 'configured' && source !== 'categoryRoot')) {
            return null
        }

        const normalizedFilter = {
            name: name,
            source: source
        }

        if (typeof filter.label === 'string') {
            normalizedFilter.label = filter.label
        }

        if (source === 'configured') {
            normalizedFilter.children = normalizedChildren
        } else if (source === 'categoryRoot') {
            normalizedFilter.rootName = filter.rootName.trim()
        }

        return normalizedFilter
    }

    const validateAndNormalizeSearchFilters = function(body) {
        const errors = []

        if (body == null || typeof body !== 'object' || Array.isArray(body)) {
            return {
                errors: ['Body must be a JSON object'],
                value: null
            }
        }

        if (!Object.prototype.hasOwnProperty.call(body, 'primaryCategoriesMode')) {
            errors.push('primaryCategoriesMode is required')
        }
        if (!Object.prototype.hasOwnProperty.call(body, 'primaryRootName')) {
            errors.push('primaryRootName is required')
        }
        if (!Object.prototype.hasOwnProperty.call(body, 'filters')) {
            errors.push('filters is required')
        }

        const mode = body.primaryCategoriesMode
        if (mode !== 'catalogFirstLevel' && mode !== 'rooted') {
            errors.push('primaryCategoriesMode must be one of: catalogFirstLevel, rooted')
        }

        if (typeof body.primaryRootName !== 'string') {
            errors.push('primaryRootName must be a string')
        }

        if (!Array.isArray(body.filters)) {
            errors.push('filters must be an array')
        }

        if (errors.length > 0) {
            return { errors: errors, value: null }
        }

        if (mode === 'catalogFirstLevel') {
            return { errors: [], value: getDefaultSearchFilters() }
        }

        const primaryRootName = normalizeNonEmptyString(body.primaryRootName)
        if (primaryRootName == null) {
            errors.push('primaryRootName must be non-empty when primaryCategoriesMode is rooted')
        }

        const normalizedFilters = body.filters.map((filter, index) => {
            return validateFilter(filter, index, errors)
        }).filter((filter) => filter != null)

        if (errors.length > 0) {
            return { errors: errors, value: null }
        }

        return {
            errors: [],
            value: {
                primaryCategoriesMode: 'rooted',
                primaryRootName: primaryRootName,
                filters: normalizedFilters
            }
        }
    }

    const redirRequest = function(options, req, res) {
        console.log("Admin endpoint: Making request to the API")
        axios.request(options).then((resp) => {
            res.status(resp.status)

            for (let header in resp.headers) {
                res.setHeader(header, resp.headers[header]);
            }

            if (resp.headers['content-type'].toLowerCase().indexOf('application/json') >= 0 || resp.headers['content-type'].toLowerCase().indexOf('application/ld+json') >= 0) {
                res.json(resp.data)
            } else {
                res.write(resp.data);
                res.end();
            }
        }).catch((err) => {
            utils.log(logger, 'error', req, 'Proxy error: ' + err.message)

            if (err.response) {
                console.log("Admin endpoint: Error from the API")
                res.status(err.response.status)
                res.json(err.response.data)
            } else {
                console.log("Admin endpoint: API Unreachable")
                res.status(504)
                res.json({ error: 'Service unreachable' })
            }
        })
    }

    function isOrgAuth(user) {
        return user.organizations.filter((org) => {
            return org.roles.filter((role) => {
                return role.name.toLowerCase() == config.roles.certifier.toLowerCase()
            }).length > 0
        }).length > 0
    }

    const uploadCertificate = async function (req, res) {
        if (!req.user) {
            res.status(401)
            res.json({ error: "Missing credentials" })
        }

        // Check user permissions
        if (!utils.isAdmin(req.user) && !utils.hasRole(req.user, config.roles.certifier) && !isOrgAuth(req.user)) {
            console.log("Upload certificate: The user is not authorized to upload certificates")
            res.status(403)
            res.json({ error: "You are not authorized to upload certificates" })
            return
        }

        let vc
        try {
            const reqBody = JSON.parse(req.body)
            vc = reqBody.vc
        } catch (e) {
            console.log("Upload certificate: The body is invalid")
            res.status(400)
            res.json({ error: 'Invalid body' })
            return
        }

        if (vc == null) {
            console.log("Upload certificate: Missing VC")
            res.status(400)
            res.json({ error: 'Missing VC' })
            return
        }

        // Get the product Specification
        let productSpec;

        const specId = req.params.specId
        const url = `${utils.getAPIProtocol('catalog')}://${utils.getAPIHost('catalog')}:${utils.getAPIPort('catalog')}${utils.getAPIPath('catalog')}/productSpecification/${specId}`

        try {
            const options = {
                url: url,
			    method: 'GET'
            }
            productSpec = (await axios.request(options)).data
        } catch (e) {
            console.log("Upload certificate: The product spec does not exists")
            res.status(404)
            res.json({ error: 'The product spec does not exists' })
            return
        }

        // Patch the spec
        let body = {
            productSpecCharacteristic: productSpec.productSpecCharacteristic != null ? productSpec.productSpecCharacteristic.filter((char) => {
              return char.name != 'Compliance:VC'
            }) : []
        }

        // Add the credential as a characteristic
        body.productSpecCharacteristic.push({
            id: `urn:ngsi-ld:characteristic:${uuidv4()}`,
            name: `Compliance:VC`,
            productSpecCharacteristicValue: [{
                isDefault: true,
                value: vc
            }]
        })

        const patchOptions = {
            url: url,
            method: 'PATCH',
            data: body,
            headers: {
                'content-type': 'application/json'
            }
        }

        redirRequest(patchOptions, req, res)
    }

    const checkPermissions = function (req, res) {
        // Check if the user is an admin
        if (!utils.isAdmin(req.user)) {
            res.status(403)
            res.json({ error: "You are not authorized to access admin endpoint" })
            return
        }

        // If the user is an admin redirect the request
        // without extra validation
        const api = req.apiUrl.split('/')[2]
        const url = utils.getAPIProtocol(api) + '://' + utils.getAPIHost(api) + ':' + utils.getAPIPort(api) + utils.getAPIPath(api) + req.apiUrl.replace(`/admin/${api}`, '')

        utils.attachUserHeaders(req.headers, req.user)

        const options = {
			url: url,
			method: req.method,
			headers: utils.proxiedRequestHeaders(req)
		};


		if (typeof req.body === 'string') {
			options.data = req.body;
		}

		if (url.indexOf('/media/') >= 0) {
			options.responseType = 'arraybuffer'

			// Dissable default browser cache headers
			delete options.headers['if-modified-since'];
			delete options.headers['if-none-match'];

			options.headers['cache-control'] = 'no-cache';
		}

        redirRequest(options, req, res)
    }

    const updateDefaultCatalog = async function (req, res) {
        // Check if the user is an admin
        if (!utils.isAdmin(req.user)) {
            res.status(403)
            res.json({ error: "You are not authorized to access admin endpoint" })
            return
        }

        // Get the new ID from the request
        let catalogId;
        try {
            const reqBody = JSON.parse(req.body)
            catalogId = reqBody.catalogId
        } catch (e) {
            res.status(400)
            res.json({ error: 'Invalid body' })
            return
        }

        // Update the default catalog
        try {
            const result = await indexes.search('defaultcatalog', {})
            const mongoFb = {
                default_id: catalogId
            }
            if (result.length > 0) {
                // Update the existing document
                await indexes.updateDocument('defaultcatalog', result[0].id, mongoFb)
            } else {
                // Create a new document
                await indexes.indexDocument('defaultcatalog', uuidv4(), mongoFb)
            }
        } catch (e) {
            res.status(500)
            res.json({ error: 'Error updating default catalog: ' + e.message })
            return
        }

        res.status(200).end()
    }

    const updateSearchFiltersConfig = async function(req, res) {
        if (!utils.isAdmin(req.user)) {
            res.status(403)
            res.json({ error: "You are not authorized to access admin endpoint" })
            return
        }

        let reqBody
        try {
            reqBody = parseBody(req.body)
        } catch (e) {
            res.status(400)
            res.json({ error: 'Invalid body' })
            return
        }

        const validationResult = validateAndNormalizeSearchFilters(reqBody)
        if (validationResult.errors.length > 0) {
            res.status(400)
            res.json({
                error: 'Invalid search filters payload',
                details: validationResult.errors
            })
            return
        }

        try {
            const result = await indexes.search(SEARCH_FILTERS_COLLECTION, { id: SEARCH_FILTERS_CONFIG_ID, limit: 1 })

            if (result.length > 0) {
                await indexes.updateDocument(SEARCH_FILTERS_COLLECTION, result[0].id, {
                    searchFilters: validationResult.value
                })
            } else {
                await indexes.indexDocument(SEARCH_FILTERS_COLLECTION, SEARCH_FILTERS_CONFIG_ID, {
                    searchFilters: validationResult.value
                })
            }
        } catch (e) {
            res.status(500)
            res.json({ error: 'Error updating search filters config: ' + e.message })
            return
        }

        res.status(200)
        res.json(validationResult.value)
    }

    const updateFeatureFlagsConfig = async function(req, res) {
        if (!utils.isAdmin(req.user)) {
            res.status(403)
            res.json({ error: "You are not authorized to access admin endpoint" })
            return
        }

        let reqBody
        try {
            reqBody = parseBody(req.body)
        } catch (e) {
            res.status(400)
            res.json({ error: 'Invalid body' })
            return
        }

        const validationResult = validateAndNormalizeFeatureFlags(reqBody)
        if (validationResult.errors.length > 0) {
            res.status(400)
            res.json({
                error: 'Invalid feature flags payload',
                details: validationResult.errors
            })
            return
        }

        let effectiveFeatureFlags
        try {
            const result = await indexes.search(FEATURE_FLAGS_COLLECTION, { id: FEATURE_FLAGS_CONFIG_ID, limit: 1 })
            const existingOverrides = result.length > 0 ? normalizeFeatureFlagOverrides(result[0].features) : {}
            const updatedOverrides = Object.assign(existingOverrides, validationResult.value)

            effectiveFeatureFlags = applyFeatureFlags(getEffectiveFeatureFlags(updatedOverrides))

            if (result.length > 0) {
                await indexes.updateDocument(FEATURE_FLAGS_COLLECTION, result[0].id, {
                    features: updatedOverrides
                })
            } else {
                await indexes.indexDocument(FEATURE_FLAGS_COLLECTION, FEATURE_FLAGS_CONFIG_ID, {
                    features: updatedOverrides
                })
            }
        } catch (e) {
            res.status(500)
            res.json({ error: 'Error updating feature flags config: ' + e.message })
            return
        }

        res.status(200)
        res.json(effectiveFeatureFlags)
    }

    const loadAnalyticsConfig = async function() {
        try {
            const result = await indexes.search(ANALYTICS_CONFIG_COLLECTION, { id: ANALYTICS_CONFIG_ID, limit: 1 })

            if (result.length === 0 || result[0].analytics == null) {
                return getAnalyticsConfigResponse()
            }

            const validationResult = validateAndNormalizeAnalyticsConfig(result[0].analytics, config.analyticsSuperset.password)
            if (validationResult.errors.length > 0) {
                logger.error('Invalid analytics config stored in database: ' + validationResult.errors.join(', '))
                return getAnalyticsConfigResponse()
            }

            return applyAnalyticsConfig(validationResult.value)
        } catch (e) {
            logger.error('Error loading analytics config: ' + e.message)
            return getAnalyticsConfigResponse()
        }
    }

    const updateAnalyticsConfig = async function(req, res) {
        if (!utils.isAdmin(req.user)) {
            res.status(403)
            res.json({ error: "You are not authorized to access admin endpoint" })
            return
        }

        let reqBody
        try {
            reqBody = parseBody(req.body)
        } catch (e) {
            res.status(400)
            res.json({ error: 'Invalid body' })
            return
        }

        const validationResult = validateAndNormalizeAnalyticsConfig(reqBody, config.analyticsSuperset.password)
        if (validationResult.errors.length > 0) {
            res.status(400)
            res.json({
                error: 'Invalid analytics config payload',
                details: validationResult.errors
            })
            return
        }

        let responseBody
        try {
            const result = await indexes.search(ANALYTICS_CONFIG_COLLECTION, { id: ANALYTICS_CONFIG_ID, limit: 1 })

            if (result.length > 0) {
                await indexes.updateDocument(ANALYTICS_CONFIG_COLLECTION, result[0].id, {
                    analytics: validationResult.value
                })
            } else {
                await indexes.indexDocument(ANALYTICS_CONFIG_COLLECTION, ANALYTICS_CONFIG_ID, {
                    analytics: validationResult.value
                })
            }

            responseBody = applyAnalyticsConfig(validationResult.value)
        } catch (e) {
            res.status(500)
            res.json({ error: 'Error updating analytics config: ' + e.message })
            return
        }

        res.status(200)
        res.json(responseBody)
    }

    const getAnalyticsConfig = async function(req, res) {
        if (!utils.isAdmin(req.user)) {
            res.status(403)
            res.json({ error: "You are not authorized to access admin endpoint" })
            return
        }

        const responseBody = await loadAnalyticsConfig()

        res.status(200)
        res.json(responseBody)
    }

    return {
        checkPermissions: checkPermissions,
        uploadCertificate: uploadCertificate,
        updateDefaultCatalog: updateDefaultCatalog,
        updateSearchFiltersConfig: updateSearchFiltersConfig,
        updateFeatureFlagsConfig: updateFeatureFlagsConfig,
        getAnalyticsConfig: getAnalyticsConfig,
        updateAnalyticsConfig: updateAnalyticsConfig,
        loadAnalyticsConfig: loadAnalyticsConfig
    }
}

exports.admin = admin;
