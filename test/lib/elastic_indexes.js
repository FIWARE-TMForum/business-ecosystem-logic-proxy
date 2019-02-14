/*global expect, it, jasmine, describe */

/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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

var proxyrequire = require("proxyquire"),
    config = require("../../config"),
    utils = require("../../lib/utils"),
    testUtils = require("../utils.js"),
    elastic = require("../../lib/elastic_indexes.js"),
    md5 = require("blueimp-md5"),
    nock = require("nock");

describe("Elasticsearch indexes tests", function () {

    var getIndexLib = function getIndexLib(method, request, level) {

	if (!method) {
            method = function () {};
        }

        if (!request) {
            request = function () {};
        }

        if (!level) {
            level = function(tab, opt, cb) {
                cb(null, null);
            };
        }

        var utils = proxyrequire('../../lib/utils.js', {
            './../config.js': testUtils.getDefaultConfig()
        });

        return proxyrequire('../../lib/elastic_indexes.js', {
            '../config': testUtils.getDefaultConfig(),
	    "request": request,
            "./utils": utils,
            "levelup": level
        });
    };

    var testConfig = testUtils.getDefaultConfig();
    var elasticHost = testConfig.indexes.elasticHost;

    it("should have correct tables", function () {
        var indexes = getIndexLib();

        expect(indexes.elasticIndexes.offerings).toEqual("offerings");
        expect(indexes.elasticIndexes.products).toEqual("products");
        expect(indexes.elasticIndexes.catalogs).toEqual("catalogs");
        expect(indexes.elasticIndexes.inventory).toEqual("inventory");
        expect(indexes.elasticIndexes.orders).toEqual("orders");
    });

    it("should not fail when init can connect to elastic host", function(done) {
        var indexes = getIndexLib();

        var indexNock = nock(elasticHost)
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

        var indexNock = nock(elasticHost)
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

    xit("should use offering index and search correctly", function (done) {
        var notBundleOffer = {
            id: 2,
            productSpecification: productData,
            name: "name",
            description: "description",
            href: "http://2",
            lifecycleStatus: "Active",
            isBundle: false,
            catalog: "2",
            lastUpdate: "2017-06-01"
        };

        var notBundleCategoriesOffer = Object.assign({}, notBundleOffer, {
            id: 12,
            lifecycleStatus: "Disabled",
            category: [{ id: 13, href: "http://cat/13" }],
        });

        var notBundleMultipleCategoriesOffer = Object.assign({}, notBundleCategoriesOffer, {
            category: [{ id: 13, href: "http:13" }, { id: 14, href: "http:14" }]
        });

        var bundleOffer = Object.assign({}, notBundleOffer, {
            id: 3,
            bundledProductOffering: [{ id: 2 }],
            href: "http://3",
            productSpecification: null,
            isBundle: true,
            catalog: "2"
        });

        var bundleExpected = {
            id: "offering:3",
            originalId: 3,
            name: "name",
            sortedId: "000000000003",
            body: ["name", "description"],
            userId: md5("rock-8"),
            productSpecification: undefined,
            href: "http://3",
            lifecycleStatus: "Active",
            isBundle: true,
            catalog: "000000000002",
            lastUpdate: 1496275200000
        };

        var notBundleExpected = Object.assign({}, bundleExpected, {
            id: "offering:2",
            originalId: 2,
            name: "name",
            sortedId: "000000000002",
            productSpecification: "000000000001",
            href: "http://2",
            isBundle: false,
            catalog: "000000000002"
        });

        var notBundleCategoriesOfferExpect = Object.assign({}, notBundleExpected, {
            id: "offering:12",
            originalId: 12,
            name: "name",
            sortedId: "000000000012",
            lifecycleStatus: "Disabled",
            categoriesId: ['000000000013'],
            categoriesName: [md5("testcat13")],
            catalog: "000000000002"
        });

        var notBundleMultipleCategoriesOfferExpected = Object.assign({}, notBundleCategoriesOfferExpect, {
            categoriesId: ['000000000013', '000000000014'],
            categoriesName: [md5("testcat13"), md5("testcat14")]
        });
    });

    xit("should use products index and search correctly", function (done) {
        var productData = {
            id: 1,
            href: "http://1",
            name: "name",
            brand: "brand",
            description: "Product Description",
            lifecycleStatus: "Active",
            isBundle: false,
            productNumber: 12,
            relatedParty: [{id: "rock-8"}, {id: "rock-9"}],
            lastUpdate: "2017-06-01"
        };

        var productExpected = {
            name: 'name',
            id: "product:1",
            href: "http://1",
            lifecycleStatus: "Active",
            isBundle: false,
            productNumber: 12,
            originalId: 1,
            sortedId: "000000000001",
            body: ["name", "brand", "product description"],
            relatedPartyHash: [md5("rock-8"),  md5("rock-9")],
            relatedParty: ["rock-8", "rock-9"],
            lastUpdate: 1496275200000
        };

    });

    xit("should use catalogs index and search correctly", function (done) {
        var catalogData = {
            id: 3,
            href: "http://3",
            description: "Description",
            lifecycleStatus: "Obsolete",
            name: "Name",
            relatedParty: [{id: "rock"}],
            lastUpdate: "2017-06-01"
        };

        var catalogExpected = {
            id: "catalog:3",
            originalId: 3,
            body: ["name", "description"],
            sortedId: "000000000003",
            relatedPartyHash: [md5("rock")],
            relatedParty: ["rock"],
            href: "http://3",
            lifecycleStatus: "Obsolete",
            name: "Name",
            lastUpdate: 1496275200000
        };


    });

    xit("should use inventory index and search correctly", function (done) {
        var inventoryData = [{
            id: 12,
            productOffering: {
                id: 5,
                href: "http://myserver.com/catalog/offering/5"
            },
            relatedParty: [{id: "rock", role: "customer"}],
            href: "http://12",
            name: "inventoryName",
            status: "status",
            startDate: "2017-06-01",
            orderDate: 232323231
        }, {
            id: 13,
            productOffering: {
                id: 6,
                href: "http://myserver.com/catalog/offering/6"
            },
            relatedParty: [{id: "rock", role: "customer"}],
            href: "http://13",
            name: "inventoryName2",
            status: "status",
            startDate: "2017-06-01",
            orderDate: 232323231
        }];

        var inventoryExpected = [{
            id: "inventory:12",
            originalId: 12,
            body: ["offername2", "description2"],
            sortedId: "000000000012",
            productOffering: 5,
            relatedPartyHash: [md5("rock")],
            relatedParty: ["rock"],
            href: "http://12",
            name: "inventoryName",
            status: "status",
            lastUpdate: 1496275200000,
            orderDate: 232323231,
            startDate: "2017-06-01",
        }, {
            id: "inventory:13",
            originalId: 13,
            body: ["offername3", ""],
            sortedId: "000000000013",
            productOffering: 6,
            relatedPartyHash: [md5("rock")],
            relatedParty: ["rock"],
            href: "http://13",
            name: "inventoryName2",
            status: "status",
            lastUpdate: 1496275200000,
            orderDate: 232323231,
            startDate: "2017-06-01",
        }];

        var invOpt = {
            fieldOptions: {
                status: {
                    preserveCase: false
                },
                body: {
                    preserveCase: false
                },
                lastUpdate: {
                    sortable: true
                }
            }
        };
    });

    xit("should use order index and search correctly", function (done) {
        var orderData = {
            id: 23,
            relatedParty: [{id: "rock", role: "customer"}, {id: "user", role: "seller"}],
            href: "http://23",
            priority: "prior",
            category: "endofunctor",
            state: "active",
            notificationContact: "m@c.es",
            note: "",
            orderDate: "2017-06-01"
        };

        var orderExpected = {
            id: "order:23",
            originalId: 23,
            sortedId: "000000000023",
            relatedPartyHash: [md5("rock")],
            sellerHash: [md5("user")],
            relatedParty: ["rock", "user"],
            href: "http://23",
            priority: "prior",
            category: "endofunctor",
            state: "active",
            notificationContact: "m@c.es",
            note: "",
            lastUpdate: 1496275200000
        };

        var orderOpt = {
            fieldOptions: {
                lastUpdate: {
                    sortable: true
                },
                status: {
                    preserveCase: false
                }
            }
        };
    });



});
