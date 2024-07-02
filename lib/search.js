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
            `/category/${categoryId}`
        );

        const cat = await axios.get(url)
        return cat.data.name
    }

    const search = async (keyword, categories) => {
        const url = `${config.searchUrl}/api/SearchProduct/${keyword}`
        const body = {
            "categories": []
        }

        if (categories != null) {
            // The search engine works with category names
            // so we need to get them
            body.categories = await Promise.all(categories.split(',').map((catId) => {
                return getCategoryName(catId)
            }))
        }

        const resp = await axios.post(url, body)

        return resp.data.map((res) => {
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
