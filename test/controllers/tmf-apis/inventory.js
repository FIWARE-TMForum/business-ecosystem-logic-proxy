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

var proxyquire =  require('proxyquire'),
    Promise = require('promiz'),
    md5 = require("blueimp-md5"),
    testUtils = require('../../utils');

describe('Inventory API', function() {

    var getInventoryAPI = function(tmfUtils, utils, indexes) {
        if (!indexes) {
            indexes = {
                safeIndexExecute: function () {
                    return Promise.resolve();
                }
            };
        }

        return proxyquire('../../../controllers/tmf-apis/inventory', {
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/tmfUtils': tmfUtils,
            './../../lib/utils': utils,
            './../../lib/indexes': indexes,
            './../../lib/indexes.js': indexes
        }).inventory;
    };

    describe('Check Permissions', function() {


        //////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////// NOT ALLOWED ////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        var testNotAllowedMethod = function (method, done) {
            var inventory = getInventoryAPI({}, {});

            var req = {
                method: method
            };

            inventory.checkPermissions(req, function (err) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(405);
                expect(err.message).toBe('The HTTP method ' + method + ' is not allowed in the accessed API');
                done();
            });
        };

        it('should give a 405 error with a POST request', function (done) {
            testNotAllowedMethod('POST', done);
        });

        it('should give a 405 error with a PUT request', function (done) {
            testNotAllowedMethod('PUT', done);
        });

        it('should give a 405 error with a DELETE request', function (done) {
            testNotAllowedMethod('DELETE', done);
        });


        //////////////////////////////////////////////////////////////////////////////////////////////
        ////////////////////////////////////////// RETRIEVAL /////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        it('should call callback with error when user is not logged in', function (done) {

            var errorStatus = 401;
            var errorMessage = 'You need to be authenticated to create/update/delete resources';

            var utils = {
                validateLoggedIn: function (req, callback) {
                    callback({
                        status: errorStatus,
                        message: errorMessage
                    });
                }
            };

            var inventoryApi = getInventoryAPI({}, utils);

            // Call the method
            var req = {
                method: 'GET'
            };

            inventoryApi.checkPermissions(req, function (err) {

                expect(err).not.toBe(null);
                expect(err.status).toBe(errorStatus);
                expect(err.message).toBe(errorMessage);

                done();
            });
        });

        //////////////////////////////////////////////////////////////////////////////////////////////
        ///////////////////////////////////////// INDEXES / //////////////////////////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////////

        describe('Test index in checkPermissions middleware', function() {
            var requestHelper = function requestHelper(done, results, url, query, expectedUrl, expectedQuery) {
                var pathname = "/product";
                url = pathname + "?" + url;
                expectedUrl = pathname + "?" + expectedUrl;

                var indexes = {
                    searchInventory: q => {
                        if (expectedQuery) {
                            expect(q).toEqual(expectedQuery);
                        }


                        return Promise.resolve(results.map(x => ({document: {originalId: x}})));
                    }
                };

                var inventoryApi = getInventoryAPI({}, {}, indexes);
                var req = {
                    method: "GET",
                    apiUrl: url,
                    _parsedUrl: {
                        pathname: pathname
                    },
                    query: query
                };

                inventoryApi.checkPermissions(req, function() {
                    expect(req.apiUrl).toEqual(expectedUrl);
                    done();
                });
            };

            it('should not change request URL when inventory index fails', function(done) {
                var indexes = {
                    searchInventory: () => Promise.reject("Error")
                };
                var inventoryApi = getInventoryAPI({}, {}, indexes);
                var url = "/product?relatedParty.id=rock";
                var req = {
                    method: "GET",
                    apiUrl: url,
                    _parsedUrl: {
                        pathname: "/product"
                    },
                    query: {
                        "relatedParty.id": "rock"
                    }
                };

                inventoryApi.checkPermissions(req, function() {
                    expect(req.apiUrl).toEqual(url);
                    done();
                });
            });

            it('should change request URL to include inventory IDs when relatedParty.id is provided', function(done) {
                requestHelper(done,
                    [3, 4], "relatedParty.id=rock", {
                        "relatedParty.id": "rock"
                    }, "id=3,4", {
                        sort: {
                            field: "lastUpdate",
                            direction: "desc"
                        },
                        query: {
                            AND: {relatedPartyHash: [md5("rock")]}
                        }
                    });
            });

            var testQueryParameters = function testQueryParameters(done, params) {
                // Transform object to param=value&param2=value2
                var paramUrl = Object.keys(params).map(key => key + "=" + params[key]).join("&");
                // Transform object to index AND query (String keys must be lower case to perform index search correctly)
                var ANDs = {};
                Object.keys(params)
                        .map(key => (
                            ANDs[key]= [ (typeof params[key] === "string") ? params[key].toLowerCase() : params[key]]));

                requestHelper(done,
                    [7, 9, 11], paramUrl, params, "id=7,9,11", {
                        sort: {
                            field: "lastUpdate",
                            direction: "desc"
                        },
                        query: {AND: ANDs}
                    }
                );
            };

            it('should should change URL to include inventory IDs when no parameter are provided', function(done) {
                requestHelper(done,
                    [1, 2], "", {}, "id=1,2", {
                        sort: {
                            field: "lastUpdate",
                            direction: "desc"
                        },
                        query: {AND: {"*": ["*"]}}
                    }
                );
            });

            it('should change request URL to not add any id if no inventory results', function(done) {
                requestHelper(done,
                    [], "relatedParty.id=someother", {
                        "relatedParty.id": "someother"
                    }, "id=", {
                        sort: {
                            field: "lastUpdate",
                            direction: "desc"
                        },
                        query: {
                            AND: {relatedPartyHash: [md5("someother")]}
                        }
                    }
                );
            });

            it('should change request URL adding extra params and ids', function(done) {
                requestHelper(done,
                    [1, 2], "depth=2&fields=name", {
                        depth: "2",
                        fields: "name"
                    }, "id=1,2&depth=2&fields=name", {
                        sort: {
                            field: "lastUpdate",
                            direction: "desc"
                        },
                        query: {AND: {"*": ["*"]}}
                    }
                );

            });

            it('should change request URL to include inventory IDs when status is provided', function(done) {
                testQueryParameters(done, { status: "Accepted" });
            });

            it('should change request URL to include inventory IDs when name is provided', function(done) {
                testQueryParameters(done, { name: "Name" });
            });
        });

        var testRetrieval = function (filterRelatedPartyFields, expectedErr, done) {

            var ensureRelatedPartyIncludedCalled = false;

            var tmfUtils = {

                filterRelatedPartyFields: filterRelatedPartyFields,

                ensureRelatedPartyIncluded: function(req, callback) {
                    ensureRelatedPartyIncludedCalled = true;
                    callback(null);
                }
            };

            var utils = {

                validateLoggedIn: function (req, callback) {
                    callback(null);
                }

            };

            var req = {
                method: 'GET',
                path: '/example/api/path/product'
            };

            var inventoryApi = getInventoryAPI(tmfUtils, utils);

            inventoryApi.checkPermissions(req, function (err) {
                expect(ensureRelatedPartyIncludedCalled).toBe(true);
                expect(err).toEqual(expectedErr);
                done();
            });

        };

        it('should call callback with error when retrieving list of products and filter related party fields fails', function (done) {

            var error = {
                status: 401,
                message: 'Invalid filters'
            };

            var filterRelatedPartyFields = function (req, callback) {
                callback(error);
            };

            testRetrieval(filterRelatedPartyFields, error, done);

        });

        it('should call callback without errors when user is allowed to retrieve the list of products', function (done) {

            var filterRelatedPartyFields = function (req, callback) {
                callback();
            };

            testRetrieval(filterRelatedPartyFields, null, done);

        });

        it('should call callback without error when retrieving a single product', function (done) {

            var ensureRelatedPartyIncludedCalled = false;

            var tmfUtils = {

                ensureRelatedPartyIncluded: function(req, callback) {
                    ensureRelatedPartyIncludedCalled = true;
                    callback(null);
                }
            };

            var utils = {
                validateLoggedIn: function (req, callback) {
                    callback(null);
                }
            };

            var req = {
                method: 'GET',
                path: '/example/api/path/product/7'
            };

            var inventoryApi = getInventoryAPI(tmfUtils, utils);

            inventoryApi.checkPermissions(req, function (err) {
                expect(ensureRelatedPartyIncludedCalled).toBe(true);
                expect(err).toBe(null);
                done();
            });

        });
    });

    describe('Execute Post Validation', function() {

        var testPostValidation = function (hasPartyRole, expectedError, done) {

            var req = {
                method: 'GET',
                path: 'DSProductCatalog/api/productManagement/product/10',
                user: {
                    id: 'test'
                },
                headers: {},
                body: JSON.stringify({
                    relatedParty: [{
                        id: 'test',
                        role: 'Customer'
                    }]
                })
            };

            var inventory = getInventoryAPI({
                hasPartyRole: function() {
                    return hasPartyRole
                }
            }, {});

            inventory.executePostValidation(req, function (err, resp) {
                expect(err).toEqual(expectedError);
                expect(resp).toEqual();
                done();
            });
        };

        it('should redirect the request after validating permissions of retrieving a single product', function (done) {
            testPostValidation(true, null, done);
        });

        it('should give a 403 error when the user is not the customer who acquired the product', function (done) {

            var error = {
                'status': 403,
                'message': 'You are not authorized to retrieve the specified product from the inventory'
            };

            testPostValidation(false, error, done);
        });
    });
});
