/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
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
    testUtils = require('../../utils');

describe('Inventory API', function() {

    var getInventoryAPI = function(tmfUtils, utils) {
        return proxyquire('../../../controllers/tmf-apis/inventory', {
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/tmfUtils': tmfUtils,
            './../../lib/utils': utils
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
                'message': 'You are not authorized to retrieve the specified offering from the inventory'
            };

            testPostValidation(false, error, done);
        });

        it('should filter non-owned products when retrieving list of products', function(done) {

            var utils = jasmine.createSpyObj('utils', ['updateBody']);
            var tmfUtils = jasmine.createSpyObj('tmfUtils', ['hasPartyRole']);
            tmfUtils.hasPartyRole.and.returnValues(false, true, false);

            var inventory = getInventoryAPI(tmfUtils, utils);

            var validProduct = {
                relatedParty: [{
                    id: 'test',
                    role: 'customEr'
                }]
            };

            var body = [{
                relatedParty: [{
                    id: 'owner',
                    role: 'Customer'
                }]
            },{
                relatedParty: [{
                    id: 'test',
                    role: 'customEr'
                }]
            },{
                relatedParty: [{
                    id: 'test',
                    role: 'Seller'
                }]
            }];

            var req = {
                method: 'GET',
                path: 'DSProductCatalog/api/productManagement/product',
                user: {
                    id: 'test'
                },
                body: JSON.stringify(body)
            };

            inventory.executePostValidation(req, function(err) {
                expect(err).toBe(null);
                expect(utils.updateBody).toHaveBeenCalledWith(req, [validProduct]);

                for (var i in body) {
                    expect(tmfUtils.hasPartyRole).toHaveBeenCalledWith(req, body[i].relatedParty, 'customer');
                }

                done();
            });
        });
    });
});
