/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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

const proxyquire = require('proxyquire')
const testUtils = require('../../utils')

describe('Inventory API', function() {
    const getInventoryAPI = function(tmfUtils, utils, indexes) {
        if (!indexes) {
            indexes = {
                safeIndexExecute: function() {
                    return Promise.resolve();
                }
            };
        }

        return proxyquire('../../../controllers/tmf-apis/inventory', {
            './../../lib/logger': testUtils.emptyLogger,
            './../../lib/tmfUtils': tmfUtils,
            './../../lib/utils': utils
        }).inventory;
    };

    describe('Check Permissions', function() {
        /// ///////////////////////////////////////////////////////////////////////////////////////////
        /// ////////////////////////////////////// NOT ALLOWED ////////////////////////////////////////
        /// ///////////////////////////////////////////////////////////////////////////////////////////

        const testNotAllowedMethod = function(method, done) {
            const inventory = getInventoryAPI({}, {});

            const req = {
                method: method
            };

            inventory.checkPermissions(req, function(err) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(405);
                expect(err.message).toBe('The HTTP method ' + method + ' is not allowed in the accessed API');
                done();
            });
        };

        it('should give a 405 error with a POST request', function(done) {
            testNotAllowedMethod('POST', done);
        });

        it('should give a 405 error with a PUT request', function(done) {
            testNotAllowedMethod('PUT', done);
        });

        it('should give a 405 error with a DELETE request', function(done) {
            testNotAllowedMethod('DELETE', done);
        });

        /// ///////////////////////////////////////////////////////////////////////////////////////////
        /// /////////////////////////////////////// RETRIEVAL /////////////////////////////////////////
        /// ///////////////////////////////////////////////////////////////////////////////////////////

        it('should call callback with error when user is not logged in', function(done) {
            const errorStatus = 401;
            const errorMessage = 'You need to be authenticated to create/update/delete resources';

            const utils = {
                validateLoggedIn: function(req, callback) {
                    callback({
                        status: errorStatus,
                        message: errorMessage
                    });
                }
            };

            const inventoryApi = getInventoryAPI({}, utils);

            // Call the method
            const req = {
                method: 'GET'
            };

            inventoryApi.checkPermissions(req, function(err) {
                expect(err).not.toBe(null);
                expect(err.status).toBe(errorStatus);
                expect(err.message).toBe(errorMessage);

                done();
            });
        });

        const testRetrieval = function(filterRelatedPartyFields, expectedErr, done) {
            let ensureRelatedPartyIncludedCalled = false;

            const tmfUtils = {
                filterRelatedPartyFields: filterRelatedPartyFields,

                ensureRelatedPartyIncluded: function(req, callback) {
                    ensureRelatedPartyIncludedCalled = true;
                    callback(null);
                }
            };

            const utils = {
                validateLoggedIn: function(req, callback) {
                    callback(null);
                }
            };

            const req = {
                method: 'GET',
                path: '/example/api/path/product'
            };

            const inventoryApi = getInventoryAPI(tmfUtils, utils);

            inventoryApi.checkPermissions(req, function(err) {
                expect(ensureRelatedPartyIncludedCalled).toBe(true);
                expect(err).toEqual(expectedErr);
                done();
            });
        };

        it('should call callback with error when retrieving list of products and filter related party fields fails', function(done) {
            const error = {
                status: 401,
                message: 'Invalid filters'
            };

            const filterRelatedPartyFields = function(req, callback) {
                callback(error);
            };

            testRetrieval(filterRelatedPartyFields, error, done);
        });

        it('should call callback without errors when user is allowed to retrieve the list of products', function(done) {
            const filterRelatedPartyFields = function(req, callback) {
                callback();
            };

            testRetrieval(filterRelatedPartyFields, null, done);
        });

        it('should call callback without error when retrieving a single product', function(done) {
            let ensureRelatedPartyIncludedCalled = false;

            const tmfUtils = {
                ensureRelatedPartyIncluded: function(req, callback) {
                    ensureRelatedPartyIncludedCalled = true;
                    callback(null);
                }
            };

            const utils = {
                validateLoggedIn: function(req, callback) {
                    callback(null);
                }
            };

            const req = {
                method: 'GET',
                path: '/example/api/path/product/7'
            };

            const inventoryApi = getInventoryAPI(tmfUtils, utils);

            inventoryApi.checkPermissions(req, function(err) {
                expect(ensureRelatedPartyIncludedCalled).toBe(true);
                expect(err).toBe(null);
                done();
            });
        });
    });

    describe('Execute Post Validation', function() {
        const testPostValidation = function(hasPartyRole, expectedError, done) {
            const req = {
                method: 'GET',
                path: 'DSProductCatalog/api/productManagement/product/10',
                user: {
                    id: 'test'
                },
                headers: {},
                body: JSON.stringify({
                    relatedParty: [
                        {
                            id: 'test',
                            role: 'Customer'
                        }
                    ]
                })
            };

            const inventory = getInventoryAPI(
                {
                    hasPartyRole: function() {
                        return hasPartyRole;
                    }
                },
                {}
            );

            inventory.executePostValidation(req, function(err, resp) {
                expect(err).toEqual(expectedError);
                expect(resp).toEqual();
                done();
            });
        };

        it('should redirect the request after validating permissions of retrieving a single product', function(done) {
            testPostValidation(true, null, done);
        });

        it('should give a 403 error when the user is not the customer who acquired the product', function(done) {
            const error = {
                status: 403,
                message: 'You are not authorized to retrieve the specified product from the inventory'
            };

            testPostValidation(false, error, done);
        });
    });
});
