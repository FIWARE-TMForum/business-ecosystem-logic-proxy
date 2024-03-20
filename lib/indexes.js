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

//const { Client } = require('@elastic/elasticsearch')
const { MongoClient } = require("mongodb")
const config = require('./../config')

let uri;
if (config.mongoDb.user != null && config.mongoDb.user.length > 0) {
    uri = `mongodb://${config.mongoDb.user}:${config.mongoDb.password}@${config.mongoDb.server}:${config.mongoDb.port}/${config.mongoDb.db}?authSource=${config.mongoDb.db}`
} else {
    uri = `mongodb://${config.mongoDb.server}:${config.mongoDb.port}/${config.mongoDb.db}`
}

let client;
let db

const init = async () => {
    client = new MongoClient(uri)

    await client.connect()
    db = client.db(config.mongoDb.db)
}

const indexDocument = async (index, id, document) => {
    if (client == null) {
        await init()
    }

    const collection = db.collection(index)

    document.id = id
    return collection.insertOne(document)
}

const updateDocument = async (index, id, document) => {
    if (client == null) {
        await init()
    }

    const collection = db.collection(index)

    let update = {
        '$set': {}
    }
    for (let [key, value] of Object.entries(document)) {
        update['$set'][key] = value
    }

    console.log(update)
    return collection.updateOne({
        id: id
    }, update)
}

const buildQuery = (queryParams) => {
    let query = {}

    for (let [key, value] of Object.entries(queryParams)) {
        if (key == 'offset' || key == 'limit') {
            continue
        }

        const values = value.split(',')

        if (values.length > 1) {
            // Adding an or query
            query['$or'] = values.map((val) => {
                let qp = {}
                qp[key] = val
                return qp
            })
        } else {
            query[key] = value
        }
    }

    return query
}

const search = async (index, queryParams) => {
    if (client == null) {
        await init()
    }

    const collection = db.collection(index)

    let query = buildQuery(queryParams)

    console.log(JSON.stringify(query))

    let limit = 12
    let offset = 0

    if (queryParams.offset != null) {
        offset = parseInt(queryParams.offset)
    }

    if (queryParams.limit != null) {
        limit = parseInt(queryParams.limit)
    }

    console.log(offset)
    console.log(limit)

    return collection.find(query).skip(offset).limit(limit).toArray()
}

exports.indexes = {
    init: init,
    indexDocument: indexDocument,
    updateDocument: updateDocument,
    search: search
}
