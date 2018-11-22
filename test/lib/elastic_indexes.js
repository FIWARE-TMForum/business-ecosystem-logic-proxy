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
    nock = require("nock");

describe("Elasticsearch indexes tests", function () {

    var getIndexLib = function getIndexLib() {
	
	var utils = proxyrequire('../../lib/utils.js', {
	    './../config.js': testUtils.getDefaultConfig()
	});

	return proxyrequire('../../lib/elastic_indexes.js', {
	    '../config': testUtils.getDefaultConfig()
	});
    };

    var testConfig = testUtils.getDefaultConfig();
    var elasticHost = testConfig.indexes.elasticHost;
    
    fit("should have correct tables", function () {
	var indexes = getIndexLib();

	console.log("--------------- 1: " + elasticHost);

	expect(indexes.elasticIndexes.offerings).toEqual("offerings");
	expect(indexes.elasticIndexes.products).toEqual("products");
	expect(indexes.elasticIndexes.catalogs).toEqual("catalogs");
	expect(indexes.elasticIndexes.inventory).toEqual("inventory");
	expect(indexes.elasticIndexes.orders).toEqual("orders");
    });

    fit("should not fail when init can connect to elastic host", function(done) {
	var indexes = getIndexLib();
	console.log("--------------- 2: " + elasticHost);
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
    
    fit("should fail when init cannot connect to elastic host", function (done) {
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
     
    });

    xit("should use products index and search correctly", function (done) {
     
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
     
    });

    xit("should use order index and search correctly", function (done) {
     
    });

    
    
});
