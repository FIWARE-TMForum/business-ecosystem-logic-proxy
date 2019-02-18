/*global expect, it, jasmine, describe */

/* Copyright (c) 2018 - 2019 CoNWeT Lab., Universidad Politécnica de Madrid
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

"use strict";

const proxyrequire = require("proxyquire");
const testUtils = require("../utils.js");
const md5 = require("blueimp-md5");
const nock = require("nock");

describe("Elasticsearch indexes tests", function () {

    let elasticMock = {
        Client: function() {
            return {
                search: function() {}
            }
        }
    }

    beforeEach(function() {
        nock.cleanAll();
    });

    const getElasticConfig = function getElasticConfig () {
        let config = testUtils.getDefaultConfig();
        config.indexes.engine = 'elasticsearch'

        return config;
    }

    const getIndexLib = function getIndexLib(elastic, request) {

        let elasticsearch = require('elasticsearch');
        if (elastic) {
            elasticsearch = elastic;
        }

        if (!request) {
            request = function () {};
        }

        let mockUtils = proxyrequire('../../lib/utils.js', {
            './../config.js': getElasticConfig()
        });

        let elasticIndexes = proxyrequire('../../lib/elastic_indexes.js', {
            '../config': getElasticConfig(),
            "elasticsearch": elasticsearch,
        });

        return proxyrequire("../../lib/indexes.js", {
            "request": request,
            "./utils": mockUtils,
            './elastic_indexes': elasticIndexes,
            '../config': getElasticConfig()
        });
    };

    let testConfig = testUtils.getDefaultConfig();
    let elasticHost = testConfig.indexes.elasticHost;

    it("should have correct tables", function () {
        let indexes = getIndexLib();

        expect(indexes.siTables.offerings).toEqual("offerings");
        expect(indexes.siTables.products).toEqual("products");
        expect(indexes.siTables.catalogs).toEqual("catalogs");
        expect(indexes.siTables.inventory).toEqual("inventory");
        expect(indexes.siTables.orders).toEqual("orders");
    });

    it("should not fail when init can connect to elastic host", function(done) {
        let indexes = getIndexLib();

        nock(elasticHost)
            .persist()
            .head(/(.*)?/)
            .reply(200);

        indexes.init().then(function () {
            done();
        }, function (reason) {
            done(new Error('Init failed'));
        });
    });

    it("should fail when init cannot connect to elastic host", function (done) {
        var indexes = getIndexLib();

        nock(elasticHost)
            .persist()
            .head(/(.*)?/)
            .socketDelay(9999)
            .reply(503);

        indexes.init().then(function () {
            done(new Error('Init did not fail'));
        }, function (reason) {
            done();
        });
    });

    let offeringResponse = {
        hits: {
            hits: [{
                _source: {
                    id: 'offering:3',
                    originalId: '3'
                },
                _score: 1
            }]
        }
    }

    const testOfferingSearch = function(query, expQuery, done) {
        let clientSpy = jasmine.createSpyObj('Client', ['search']);

        clientSpy.search.and.returnValue(offeringResponse)

        let indexes = getIndexLib();

        indexes.setClient(clientSpy);
        indexes.searchOfferings(query).then((r) => {
            // Validate stuff
            expect(r).toEqual([{
                id: 'offering:3',
                originalId: '3',
                score: '1',
                document: { id: 'offering:3', originalId: '3'}
            }]);

            expect(clientSpy.search).toHaveBeenCalledWith(expQuery);
            done();
        });
    }

    it("should use offering index and search correctly", function (done) {
        testOfferingSearch({
            query: {},
            sort: {
                field: "lastUpdate",
                direction: "desc"
            }
        }, {
            index: 'offerings',
            type: 'offerings',
            sort: [ '{"lastUpdate":{"order":"desc"}}' ],
            from: undefined,
            size: undefined,
            body: { query: { query_string: { fields: [  ], query: '' } } } }, done);
    });

    it("should use offering index when a query is provided", function(done) {
        testOfferingSearch({
            query: {
                "AND": {"lifecycleStatus":["launched"]},
            },
            sort: {
                field: "lastUpdate",
                direction: "desc"
            },
            offset: 10,
            pageSize: 5,
        }, {
            index: 'offerings',
            type: 'offerings',
            sort: [ '{"lastUpdate":{"order":"desc"}}' ],
            from: 10,
            size: 5,
            body: { query: { query_string: { fields: ['lifecycleStatus'], query: '(launched)' } } } }, done);
    });

    it("should use offering index when a complex query is provided", function(done) {
        testOfferingSearch({
            query: [
                {"AND":{"relatedPartyHash":["21232f297a57a5a743894a0e4a801fc3"],"lifecycleStatus":["active"]}},
                {"AND":{"relatedPartyHash":["21232f297a57a5a743894a0e4a801fc3"],"lifecycleStatus":["launched"]}}
            ],
            sort: {
                field: "lastUpdate",
                direction: "desc"
            },
            offset: 10,
            pageSize: 5,
        }, {
            index: 'offerings',
            type: 'offerings',
            sort: [ '{"lastUpdate":{"order":"desc"}}' ],
            from: 10,
            size: 5,
            body: { query: { query_string: {
                fields: [ 'relatedPartyHash', 'lifecycleStatus' ],
                query: '(21232f297a57a5a743894a0e4a801fc3 AND active) (21232f297a57a5a743894a0e4a801fc3 AND launched)' } } } },
                done);
    });
});
