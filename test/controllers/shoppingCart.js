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

const proxyquire = require('proxyquire');

describe('Shopping Cart', function() {
    const DEFAULT_USER = 'example-user';
    const DEFAULT_ITEM = 7;
    const DEFAULT_ERROR = 'There was an error retrieving your cart...';

    const getShoppingCartController = function(cartItemSchema) {
        return proxyquire('../../controllers/shoppingCart', {
            '../db/schemas/cartItem': cartItemSchema
        }).shoppingCart;
    };

    describe('Get Cart', function() {
        it('should return 500 when db fails', function(done) {
            let dbQueryConditions = null;

            const cartItemSchema = {
                find: function(conditions) {
                    dbQueryConditions = conditions;
                    return Promise.reject({ message: DEFAULT_ERROR })
                }
            };

            const shoppingCartController = getShoppingCartController(cartItemSchema);

            const req = { user: { id: DEFAULT_USER } };
            const res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);

            // End method is the last method called
            // we can use it to verify the requests
            res.end.and.callFake(() => {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER });

                expect(res.statusCode).toBe(500);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith({ error: DEFAULT_ERROR });
                expect(res.end).toHaveBeenCalled();

                done();
            })

            shoppingCartController.getCart(req, res);
        });

        it('should return the items given by the database', function(done) {
            const item1 = { id: 77, name: 'Off1', href: 'http://fiware.org/off2' }
            const item2 = { id: 78, name: 'Off2', href: 'http://fiware.org/off1' }

            const returnedItems = [
                {itemObject: item1},
                {itemObject: item2}
            ];
            const expectedItems = [item1, item2]

            let dbQueryConditions = null;

            const cartItemSchema = {
                find: function(conditions) {
                    dbQueryConditions = conditions;

                    const response = [];
                    returnedItems.forEach(function(item) {
                        response.push({ user: DEFAULT_USER, itemId: item.id, itemObject: item });
                    });

                    return Promise.resolve(returnedItems)
                }
            };

            const shoppingCartController = getShoppingCartController(cartItemSchema);

            const req = { user: { id: DEFAULT_USER } };
            const res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);

            res.end.and.callFake(() => {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER });

                expect(res.statusCode).toBe(200);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith(expectedItems);
                expect(res.end).toHaveBeenCalled();

                done();
            })

            shoppingCartController.getCart(req, res);
        });
    });

    describe('Get Item', function() {
        it('should return 500 when db fails', function(done) {
            let dbQueryConditions = null;

            const cartItemSchema = {
                findOne: function(conditions) {
                    dbQueryConditions = conditions;
                    return Promise.reject({ message: DEFAULT_ERROR })
                }
            };

            const shoppingCartController = getShoppingCartController(cartItemSchema);

            const req = { user: { id: DEFAULT_USER }, params: { id: DEFAULT_ITEM } };
            const res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);
            res.end.and.callFake(() => {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER, itemId: DEFAULT_ITEM });

                expect(res.statusCode).toBe(500);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith({ error: DEFAULT_ERROR });
                expect(res.end).toHaveBeenCalled();

                done();
            })

            shoppingCartController.getItem(req, res);
        });

        const getItemDBNotFail = function(returnedItem, expectedStatus, expectedBody, done) {
            let dbQueryConditions = null;

            const cartItemSchema = {
                findOne: function(conditions) {
                    dbQueryConditions = conditions;

                    let response = null;

                    if (returnedItem) {
                        response = { user: DEFAULT_USER, itemId: DEFAULT_ITEM, itemObject: returnedItem };
                    }

                    return Promise.resolve(response)
                }
            };

            const shoppingCartController = getShoppingCartController(cartItemSchema);

            const req = { user: { id: DEFAULT_USER }, params: { id: DEFAULT_ITEM } };
            const res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);
            res.end.and.callFake(() => {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER, itemId: DEFAULT_ITEM });

                expect(res.statusCode).toBe(expectedStatus);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith(expectedBody);
                expect(res.end).toHaveBeenCalled();

                done();
            })

            shoppingCartController.getItem(req, res);
        };

        it('should return the item given by the database', function(done) {
            const returnedItem = { id: 77, name: 'Off1', href: 'http://fiware.org/off2' };

            getItemDBNotFail(returnedItem, 200, returnedItem, done);
        });

        it('should return the item given by the database', function(done) {
            getItemDBNotFail(null, 404, { error: 'Item not found in your cart' }, done);
        });
    });

    describe('Add to cart', function() {
        const addInvalidInput = function(reqBody, expectedStatus, expectedBody, done) {
            const cartItemSchema = function() {
                return {};
            };

            const shoppingCartController = getShoppingCartController(cartItemSchema);

            const req = { user: { id: DEFAULT_USER }, body: reqBody };
            const res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);
            res.end.and.callFake(() => {
                expect(res.statusCode).toBe(expectedStatus);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith(expectedBody);
                expect(res.end).toHaveBeenCalled();

                done();
            })

            shoppingCartController.add(req, res);
        };

        it('should return 400 when body is an invalid JSON', function(done) {
            addInvalidInput('{ invalid JSON', 400, { error: 'Invalid Cart Item' }, done);
        });

        it('should return 400 when body does not contain an item ID', function(done) {
            addInvalidInput(JSON.stringify({ name: 'Example' }), 400, { error: 'Cart Item ID missing' }, done);
        });

        const addItemDBFails = function(code, expectedStatus, expectedBody, done) {
            const itemSent = { id: DEFAULT_ITEM, name: 'OFFERING', href: 'http://www.fiware.org' };
            let itemSaved = null;

            const cartItemSchema = function() {
                return {
                    save: function() {
                        itemSaved = this;
                        return Promise.reject({ code: code, message: expectedBody.error })
                    }
                };
            };

            const shoppingCartController = getShoppingCartController(cartItemSchema);

            const req = { user: { id: DEFAULT_USER }, body: JSON.stringify(itemSent) };
            const res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);
            res.end.and.callFake(() => {
                expect(itemSaved.user).toBe(DEFAULT_USER);
                expect(itemSaved.itemId).toBe(DEFAULT_ITEM);
                expect(itemSaved.itemObject).toEqual(itemSent);

                expect(res.statusCode).toBe(expectedStatus);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith(expectedBody);
                expect(res.end).toHaveBeenCalled();

                done();
            })

            shoppingCartController.add(req, res);
        };

        it('should return 500 when db fails', function(done) {
            addItemDBFails(1, 500, { error: DEFAULT_ERROR }, done);
        });

        it('should return 409 when the item is already present in the database', function(done) {
            addItemDBFails(11000, 409, { error: 'This item is already in your shopping cart' }, done);
        });

        it('should return 200 and set header when item added', function(done) {
            const itemSent = { id: DEFAULT_ITEM, name: 'OFFERING', href: 'http://www.fiware.org' };
            let itemSaved = null;

            const cartItemSchema = function() {
                return {
                    save: function() {
                        itemSaved = this;
                        return Promise.resolve()
                    }
                };
            };

            const shoppingCartController = getShoppingCartController(cartItemSchema);

            const req = { user: { id: DEFAULT_USER }, body: JSON.stringify(itemSent), url: '/shoppingCart/item/' };
            const res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);
            res.end.and.callFake(() => {
                expect(itemSaved.user).toBe(DEFAULT_USER);
                expect(itemSaved.itemId).toBe(DEFAULT_ITEM);
                expect(itemSaved.itemObject).toEqual(itemSent);

                expect(res.statusCode).toBe(201);
                expect(res.setHeader).toHaveBeenCalledWith('location', req.url + itemSent.id);
                expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
                expect(res.end).toHaveBeenCalled();

                done();
            })

            shoppingCartController.add(req, res);
        });
    });

    describe('Remove from the Cart', function() {
        it('should return 500 when db fails', function(done) {
            let dbQueryConditions = null;

            const cartItemSchema = {
                deleteOne: function(conditions) {
                    dbQueryConditions = conditions;
                    return Promise.reject({ message: DEFAULT_ERROR })
                }
            };

            const shoppingCartController = getShoppingCartController(cartItemSchema);

            const req = { user: { id: DEFAULT_USER }, params: { id: DEFAULT_ITEM } };
            const res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);
            res.end.and.callFake(() => {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER, itemId: DEFAULT_ITEM });

                expect(res.statusCode).toBe(500);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith({ error: DEFAULT_ERROR });
                expect(res.end).toHaveBeenCalled();

                done();
            })

            shoppingCartController.remove(req, res);
        });

        it('should return 204 when item removed', function(done) {
            let dbQueryConditions = null;

            const cartItemSchema = {
                deleteOne: function(conditions) {
                    dbQueryConditions = conditions;
                    return Promise.resolve({ deletedCount: 1 } )
                }
            };

            const shoppingCartController = getShoppingCartController(cartItemSchema);

            const req = { user: { id: DEFAULT_USER }, params: { id: DEFAULT_ITEM } };
            const res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);
            res.end.and.callFake(() => {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER, itemId: DEFAULT_ITEM });

                expect(res.statusCode).toBe(204);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).not.toHaveBeenCalled();
                expect(res.end).toHaveBeenCalled();

                done();
            })

            shoppingCartController.remove(req, res);
        });

        it('should return 404 when item is not in the cart', function(done) {
            let dbQueryConditions = null;

            const cartItemSchema = {
                deleteOne: function(conditions) {
                    dbQueryConditions = conditions;
                    return Promise.resolve({ result: { deletedCount: 0 } });
                }
            };

            const shoppingCartController = getShoppingCartController(cartItemSchema);

            const req = { user: { id: DEFAULT_USER }, params: { id: DEFAULT_ITEM } };
            const res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);
            res.end.and.callFake(() => {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER, itemId: DEFAULT_ITEM });

                expect(res.statusCode).toBe(404);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith({
                    error: 'The given ordering item cannot ' + 'be deleted since it was not present in your cart'
                });
                expect(res.end).toHaveBeenCalled();

                done();
            })
            shoppingCartController.remove(req, res);
        });
    });

    describe('Empty Cart', function() {
        it('should return 500 when db fails', function(done) {
            let dbQueryConditions = null;

            const cartItemSchema = {
                deleteMany: function(conditions) {
                    dbQueryConditions = conditions;
                    return Promise.reject({ message: DEFAULT_ERROR })
                }
            };

            const shoppingCartController = getShoppingCartController(cartItemSchema);

            const req = { user: { id: DEFAULT_USER } };
            const res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);
            res.end.and.callFake(() => {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER });

                expect(res.statusCode).toBe(500);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).toHaveBeenCalledWith({ error: DEFAULT_ERROR });
                expect(res.end).toHaveBeenCalled();

                done();
            })
            shoppingCartController.empty(req, res);
        });

        it('should return 204 when item removed', function(done) {
            let dbQueryConditions = null;

            const cartItemSchema = {
                deleteMany: function(conditions) {
                    dbQueryConditions = conditions;
                    return Promise.resolve({ result: { deletedCount: 1 } })
                }
            };

            const shoppingCartController = getShoppingCartController(cartItemSchema);

            const req = { user: { id: DEFAULT_USER } };
            const res = jasmine.createSpyObj('res', ['json', 'setHeader', 'end']);
            res.end.and.callFake(() => {
                expect(dbQueryConditions).toEqual({ user: DEFAULT_USER });

                expect(res.statusCode).toBe(204);
                expect(res.setHeader).not.toHaveBeenCalled();
                expect(res.json).not.toHaveBeenCalled();
                expect(res.end).toHaveBeenCalled();

                done();
            })
            shoppingCartController.empty(req, res);
        });
    });
});
