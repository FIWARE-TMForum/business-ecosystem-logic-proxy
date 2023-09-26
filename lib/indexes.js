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

const { Client } = require('@elastic/elasticsearch')
const config = require('./../config')

let client;

const init = async () => {
    client = new Client({
        node: config.indexes.elasticHost,
        auth: {
            username: 'elastic',
            password: '2jmf5m*H=MiGaWFHIwdd'
        }
    })

    // Create offering indexes
    try {
        await client.indices.create({ index: 'offering' })
    } catch(e) {
        // Index already exists
    }
}

const indexDocument = async (index, id, document) => {
    return client.index({
        index: index,
        id: id,
        document: document
    })
}

const buildQuery = (queryParams) => {
    let query = {
        bool: {
            must: []
        }
    }

    for (let [key, value] of Object.entries(queryParams)) {
        let terms = {}
        let values = value.split(',')

        if (values.length > 1) {
            terms.terms = {}
            terms.terms[key] = values
        } else {
            terms.term = {}
            terms.term[key] = value
        }

        query.bool.must.push(terms)
    }

    console.log(query)
    return query
}

const search = async (index, queryParams) => {
    if (client == null) {
        await init()
    }

    return client.search({
        index: index,
        query: buildQuery(queryParams)
    })
}

exports.indexes = {
    init: init,
    indexDocument: indexDocument,
    search: search
}
