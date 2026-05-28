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
const config = require('../config')
const utils = require('./utils')

const searchEngine = (() => {

    const getCategoryName = async (categoryId) => {
        const url = utils.getAPIURL(
            config.endpoints.catalog.appSsl,
            config.endpoints.catalog.host,
            config.endpoints.catalog.port,
            `${config.endpoints.catalog.apiPath}/category/${categoryId}`
        );

        const cat = await axios.get(url)
        return cat.data.name
    }

    const parseCategoryFilters = (categories) => {
        const parsed = {
            categoryIds: [],
            dynamicFilters: {}
        }

        if (categories == null || categories === '') {
            return parsed
        }

        categories.split(',').forEach((rawToken) => {
            const token = rawToken.trim()
            const separatorIndex = token.indexOf('::')

            if (token.length === 0) {
                return
            }

            if (separatorIndex <= 0 || separatorIndex >= token.length - 2) {
                parsed.categoryIds.push(token)
                return
            }

            const key = token.slice(0, separatorIndex).trim()
            const value = token.slice(separatorIndex + 2).trim()

            if (!key || !value) {
                parsed.categoryIds.push(token)
                return
            }

            if (!parsed.dynamicFilters[key]) {
                parsed.dynamicFilters[key] = []
            }
            parsed.dynamicFilters[key].push(value)
        })

        return parsed
    }

    const search = async (keyword, categories, page) => {
        let url = `${config.searchUrl}/api/SearchProduct`
        const hasKeyword = keyword != null && String(keyword).trim().length > 0
        const body = {
            "categories": []
        }
        const parsedFilters = parseCategoryFilters(categories)

        if (hasKeyword) {
            url = `${url}/${keyword}`
        }

        if (page.offset != null && page.pageSize != null) {
            // Calculate the page
            let pageN = Math.floor(parseInt(page.offset) / parseInt(page.pageSize))
            url = url + `?page=${pageN}&size=${page.pageSize}`
        }

        if (parsedFilters.categoryIds.length > 0) {
            // The search engine works with category names
            // so we need to get them
            body.categories = await Promise.all(parsedFilters.categoryIds.map((catId) => {
                return getCategoryName(catId)
            }))
        }

        Object.keys(parsedFilters.dynamicFilters).forEach((key) => {
            body[key] = parsedFilters.dynamicFilters[key]
        })

        const resp = await axios.post(url, body)

        console.log('Search response:')
        console.log(resp.data)

        const responseData = Array.isArray(resp.data) ? resp.data : []

        return responseData.map((res) => {
            return {
                id: res.id
            }
        })
    }

    return {
        search: search
    }
})();

exports.searchEngine = searchEngine
