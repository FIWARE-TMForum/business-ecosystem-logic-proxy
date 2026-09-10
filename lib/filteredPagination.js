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

const base64url = require('base64url')

const TOKEN_HEADER = 'X-Filtered-Pagination-Token'
const TOKEN_HEADER_LOWER = TOKEN_HEADER.toLowerCase()

const parseInteger = function(value, defaultValue) {
    if (value == null || value === '') {
        return defaultValue
    }

    const parsed = parseInt(value, 10)

    if (isNaN(parsed)) {
        return defaultValue
    }

    return parsed
}

const buildError = function(message) {
    const error = new Error(message)
    error.status = 400
    return error
}

const encodeToken = function(offset) {
    return base64url(JSON.stringify({
        offset: offset
    }))
}

const decodeToken = function(token) {
    if (!token) {
        return null
    }

    try {
        const decoded = JSON.parse(base64url.decode(token))

        if (decoded == null || decoded.offset == null || isNaN(parseInt(decoded.offset, 10))) {
            throw buildError('Invalid filtered pagination token')
        }

        return {
            offset: parseInt(decoded.offset, 10)
        }
    } catch (e) {
        throw buildError('Invalid filtered pagination token')
    }
}

const getTokenFromHeaders = function(headers) {
    if (!headers) {
        return null
    }

    return headers[TOKEN_HEADER] || headers[TOKEN_HEADER_LOWER] || null
}

const getStartOffset = function(options) {
    const decodedToken = decodeToken(options.token)

    if (decodedToken) {
        return decodedToken.offset
    }

    return parseInteger(options.offset, 0)
}

const paginate = async function(options) {
    const limit = parseInteger(options.limit, -1)

    if (limit <= 0) {
        throw buildError('Filtered pagination requires a positive limit')
    }

    const fetchPage = options.fetchPage
    const predicate = options.predicate

    if (typeof fetchPage !== 'function') {
        throw buildError('Filtered pagination requires a page fetcher')
    }

    if (typeof predicate !== 'function') {
        throw buildError('Filtered pagination requires a predicate')
    }

    let upstreamOffset = getStartOffset(options)
    const body = []
    let exhausted = false

    while (body.length < limit && !exhausted) {
        const page = await fetchPage(upstreamOffset, limit)

        if (!Array.isArray(page) || page.length === 0) {
            exhausted = true
            break
        }

        let pageIndex = 0

        while (pageIndex < page.length && body.length < limit) {
            const item = page[pageIndex]
            upstreamOffset += 1
            pageIndex += 1

            if (await predicate(item)) {
                body.push(item)
            }
        }

        if (pageIndex === page.length && page.length < limit) {
            exhausted = true
        }
    }

    return {
        body: body,
        token: exhausted ? null : encodeToken(upstreamOffset)
    }
}

exports.filteredPagination = {
    TOKEN_HEADER: TOKEN_HEADER,
    TOKEN_HEADER_LOWER: TOKEN_HEADER_LOWER,
    encodeToken: encodeToken,
    decodeToken: decodeToken,
    getTokenFromHeaders: getTokenFromHeaders,
    paginate: paginate
}
