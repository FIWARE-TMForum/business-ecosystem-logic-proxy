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

var proxyquire = require('proxyquire');

describe('Shopping Cart', function() {
    var DEFAULT_USER = 'example-user';
    var DEFAULT_ITEM = 7;
    var DEFAULT_ERROR = 'There was an error retrieving your cart...';

    var getShoppingCartController = function(cartItemSchema) {
        return proxyquire('../../controllers/shoppingCart', {
            '../db/schemas/cartItem': cartItemSchema
        }).shoppingCart;
    };

    describe('Get Cart', function() {
        it('should return 500 when db fails', function(done) {
            var dbQueryConditions = null;

            var cartItemSchema = {
                find: function(conditions, callback) {
                    dbQueryConditions = conditions;
                    callback({ message: DEFAULT_ERROR });
                }
            };

            var shoppingCartController = getShoppingCartController(cartItemSchema);

            var req = { user: { id: DEFAULT_USER } };
            var res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);

            shoppingCartController.getCart(req, res);

            // Wail till request has been processed
            setTimeout(function() {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER });

                expect(res.statusCode).toBe(500);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith({ error: DEFAULT_ERROR });
                expect(res.end).toHaveBeenCalled();

                done();
            }, 100);
        });

        it('should return the items given by the database', function(done) {
            var returnedItems = [
                { id: 77, name: 'Off1', href: 'http://fiware.org/off2' },
                { id: 78, name: 'Off2', href: 'http://fiware.org/off1' }
            ];

            var dbQueryConditions = null;

            var cartItemSchema = {
                find: function(conditions, callback) {
                    dbQueryConditions = conditions;

                    var response = [];
                    returnedItems.forEach(function(item) {
                        response.push({ user: DEFAULT_USER, itemId: item.id, itemObject: item });
                    });

                    callback(null, response);
                }
            };

            var shoppingCartController = getShoppingCartController(cartItemSchema);

            var req = { user: { id: DEFAULT_USER } };
            var res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);

            shoppingCartController.getCart(req, res);

            // Wail till request has been processed
            setTimeout(function() {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER });

                expect(res.statusCode).toBe(200);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith(returnedItems);
                expect(res.end).toHaveBeenCalled();

                done();
            }, 100);
        });
    });

    describe('Get Item', function() {
        it('should return 500 when db fails', function(done) {
            var dbQueryConditions = null;

            var cartItemSchema = {
                findOne: function(conditions, callback) {
                    dbQueryConditions = conditions;
                    callback({ message: DEFAULT_ERROR });
                }
            };

            var shoppingCartController = getShoppingCartController(cartItemSchema);

            var req = { user: { id: DEFAULT_USER }, params: { id: DEFAULT_ITEM } };
            var res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);

            shoppingCartController.getItem(req, res);

            // Wail till request has been processed
            setTimeout(function() {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER, itemId: DEFAULT_ITEM });

                expect(res.statusCode).toBe(500);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith({ error: DEFAULT_ERROR });
                expect(res.end).toHaveBeenCalled();

                done();
            }, 100);
        });

        var getItemDBNotFail = function(returnedItem, expectedStatus, expectedBody, done) {
            var dbQueryConditions = null;

            var cartItemSchema = {
                findOne: function(conditions, callback) {
                    dbQueryConditions = conditions;

                    var response = null;

                    if (returnedItem) {
                        response = { user: DEFAULT_USER, itemId: DEFAULT_ITEM, itemObject: returnedItem };
                    }

                    callback(null, response);
                }
            };

            var shoppingCartController = getShoppingCartController(cartItemSchema);

            var req = { user: { id: DEFAULT_USER }, params: { id: DEFAULT_ITEM } };
            var res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);

            shoppingCartController.getItem(req, res);

            // Wail till request has been processed
            setTimeout(function() {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER, itemId: DEFAULT_ITEM });

                expect(res.statusCode).toBe(expectedStatus);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith(expectedBody);
                expect(res.end).toHaveBeenCalled();

                done();
            }, 100);
        };

        it('should return the item given by the database', function(done) {
            var returnedItem = { id: 77, name: 'Off1', href: 'http://fiware.org/off2' };

            getItemDBNotFail(returnedItem, 200, returnedItem, done);
        });

        it('should return the item given by the database', function(done) {
            getItemDBNotFail(null, 404, { error: 'Item not found in your cart' }, done);
        });
    });

    describe('Add to cart', function() {
        var addInvalidInput = function(reqBody, expectedStatus, expectedBody, done) {
            var cartItemSchema = function() {
                return {};
            };

            var shoppingCartController = getShoppingCartController(cartItemSchema);

            var req = { user: { id: DEFAULT_USER }, body: reqBody };
            var res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);

            shoppingCartController.add(req, res);

            // Wail till request has been processed
            setTimeout(function() {
                expect(res.statusCode).toBe(expectedStatus);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith(expectedBody);
                expect(res.end).toHaveBeenCalled();

                done();
            }, 100);
        };

        it('should return 400 when body is an invalid JSON', function(done) {
            addInvalidInput('{ invalid JSON', 400, { error: 'Invalid Cart Item' }, done);
        });

        it('should return 400 when body does not contain an item ID', function(done) {
            addInvalidInput(JSON.stringify({ name: 'Example' }), 400, { error: 'Cart Item ID missing' }, done);
        });

        var addItemDBFails = function(code, expectedStatus, expectedBody, done) {
            var itemSent = { id: DEFAULT_ITEM, name: 'OFFERING', href: 'http://www.fiware.org' };
            var itemSaved = null;

            var cartItemSchema = function() {
                return {
                    save: function(callback) {
                        itemSaved = this;
                        callback({ code: code, message: expectedBody.error });
                    }
                };
            };

            var shoppingCartController = getShoppingCartController(cartItemSchema);

            var req = { user: { id: DEFAULT_USER }, body: JSON.stringify(itemSent) };
            var res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);

            shoppingCartController.add(req, res);

            // Wail till request has been processed
            setTimeout(function() {
                expect(itemSaved.user).toBe(DEFAULT_USER);
                expect(itemSaved.itemId).toBe(DEFAULT_ITEM);
                expect(itemSaved.itemObject).toEqual(itemSent);

                expect(res.statusCode).toBe(expectedStatus);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith(expectedBody);
                expect(res.end).toHaveBeenCalled();

                done();
            }, 100);
        };

        it('should return 500 when db fails', function(done) {
            addItemDBFails(1, 500, { error: DEFAULT_ERROR }, done);
        });

        it('should return 409 when the item is already present in the database', function(done) {
            addItemDBFails(11000, 409, { error: 'This item is already in your shopping cart' }, done);
        });

        it('should return 200 and set header when item added', function(done) {
            var itemSent = { id: DEFAULT_ITEM, name: 'OFFERING', href: 'http://www.fiware.org' };
            var itemSaved = null;

            var cartItemSchema = function() {
                return {
                    save: function(callback) {
                        itemSaved = this;
                        callback();
                    }
                };
            };

            var shoppingCartController = getShoppingCartController(cartItemSchema);

            var req = { user: { id: DEFAULT_USER }, body: JSON.stringify(itemSent), url: '/shoppingCart/item/' };
            var res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);

            shoppingCartController.add(req, res);

            // Wail till request has been processed
            setTimeout(function() {
                expect(itemSaved.user).toBe(DEFAULT_USER);
                expect(itemSaved.itemId).toBe(DEFAULT_ITEM);
                expect(itemSaved.itemObject).toEqual(itemSent);

                expect(res.statusCode).toBe(201);
                expect(res.setHeader).toHaveBeenCalledWith('location', req.url + itemSent.id);
                expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
                expect(res.end).toHaveBeenCalled();

                done();
            }, 100);
        });
    });

    describe('Remove from the Cart', function() {
        it('should return 500 when db fails', function(done) {
            var dbQueryConditions = null;

            var cartItemSchema = {
                remove: function(conditions, callback) {
                    dbQueryConditions = conditions;
                    callback({ message: DEFAULT_ERROR });
                }
            };

            var shoppingCartController = getShoppingCartController(cartItemSchema);

            var req = { user: { id: DEFAULT_USER }, params: { id: DEFAULT_ITEM } };
            var res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);

            shoppingCartController.remove(req, res);

            // Wail till request has been processed
            setTimeout(function() {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER, itemId: DEFAULT_ITEM });

                expect(res.statusCode).toBe(500);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith({ error: DEFAULT_ERROR });
                expect(res.end).toHaveBeenCalled();

                done();
            }, 100);
        });

        it('should return 204 when item removed', function(done) {
            var dbQueryConditions = null;

            var cartItemSchema = {
                remove: function(conditions, callback) {
                    dbQueryConditions = conditions;
                    callback(null, { n: 1 } );
                }
            };

            var shoppingCartController = getShoppingCartController(cartItemSchema);

            var req = { user: { id: DEFAULT_USER }, params: { id: DEFAULT_ITEM } };
            var res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);

            shoppingCartController.remove(req, res);

            // Wail till request has been processed
            setTimeout(function() {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER, itemId: DEFAULT_ITEM });

                expect(res.statusCode).toBe(204);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).not.toHaveBeenCalled();
                expect(res.end).toHaveBeenCalled();

                done();
            }, 100);
        });

        it('should return 404 when item is not in the cart', function(done) {
            var dbQueryConditions = null;

            var cartItemSchema = {
                remove: function(conditions, callback) {
                    dbQueryConditions = conditions;
                    callback(null, { result: { n: 0 } });
                }
            };

            var shoppingCartController = getShoppingCartController(cartItemSchema);

            var req = { user: { id: DEFAULT_USER }, params: { id: DEFAULT_ITEM } };
            var res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);

            shoppingCartController.remove(req, res);

            // Wail till request has been processed
            setTimeout(function() {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER, itemId: DEFAULT_ITEM });

                expect(res.statusCode).toBe(404);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith({
                    error: 'The given ordering item cannot ' + 'be deleted since it was not present in your cart'
                });
                expect(res.end).toHaveBeenCalled();

                done();
            }, 100);
        });
    });

    describe('Empty Cart', function() {
        it('should return 500 when db fails', function(done) {
            var dbQueryConditions = null;

            var cartItemSchema = {
                remove: function(conditions, callback) {
                    dbQueryConditions = conditions;
                    callback({ message: DEFAULT_ERROR });
                }
            };

            var shoppingCartController = getShoppingCartController(cartItemSchema);

            var req = { user: { id: DEFAULT_USER } };
            var res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);

            shoppingCartController.empty(req, res);

            // Wail till request has been processed
            setTimeout(function() {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER });

                expect(res.statusCode).toBe(500);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith({ error: DEFAULT_ERROR });
                expect(res.end).toHaveBeenCalled();

                done();
            }, 100);
        });

        it('should return 204 when item removed', function(done) {
            var dbQueryConditions = null;

            var cartItemSchema = {
                remove: function(conditions, callback) {
                    dbQueryConditions = conditions;
                    callback(null, { result: { n: 1 } });
                }
            };

            var shoppingCartController = getShoppingCartController(cartItemSchema);

            var req = { user: { id: DEFAULT_USER } };
            var res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);

            shoppingCartController.empty(req, res);

            // Wail till request has been processed
            setTimeout(function() {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER });

                expect(res.statusCode).toBe(204);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).not.toHaveBeenCalled();
                expect(res.end).toHaveBeenCalled();

                done();
            }, 100);
        });
    });
});
