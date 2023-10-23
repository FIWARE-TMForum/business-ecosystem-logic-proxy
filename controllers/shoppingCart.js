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

const CartItem = require('../db/schemas/cartItem');

const shoppingCart = (function() {
    const endRequest = function(res, code, headers, content) {
        res.statusCode = code;

        // Headers
        if (headers) {
            for (var header in headers) {
                res.setHeader(header, headers[header]);
            }
        }

        if (content) {
            res.json(content);
        }

        res.end();
    };

    const getCart = function(req, res) {
        const userName = req.user.id;

        CartItem.find({ user: userName }).then((result) => {
            const items = [];

            result.forEach(function(cartItem) {
                items.push(cartItem.itemObject);
            });

            endRequest(res, 200, null, items);
        }).catch((err) => {
            endRequest(res, 500, null, { error: err.message });
        });
    };

    const getItem = function(req, res) {
        const userName = req.user.id;
        const itemId = req.params.id;

        CartItem.findOne({ user: userName, itemId: itemId }).then((result) => {
            if (result) {
                endRequest(res, 200, null, result.itemObject);
            } else {
                endRequest(res, 404, null, { error: 'Item not found in your cart' });
            }
        }).catch((err) => {
            endRequest(res, 500, null, { error: err.message });
        });
    };

    const add = function(req, res) {
        const userName = req.user.id;

        try {
            const item = new CartItem();
            item.user = userName;
            item.itemObject = JSON.parse(req.body);

            const itemId = item.itemObject.id;

            if (itemId) {
                item.itemId = itemId;

                item.save().then((err) => {
                    const slash = req.url.slice(-1) === '/' ? '' : '/';
                    const headers = { location: req.url + slash + itemId };
                    endRequest(res, 201, headers, { status: 'ok' });
                }).catch((err) => {
                    if (err.code === 11000) {
                        // duplicate key
                        endRequest(res, 409, null, { error: 'This item is already in your shopping cart' });
                    } else {
                        // other errors
                        endRequest(res, 500, null, { error: err.message });
                    }
                });
            } else {
                endRequest(res, 400, null, { error: 'Cart Item ID missing' });
            }
        } catch (e) {
            endRequest(res, 400, null, { error: 'Invalid Cart Item' });
        }
    };

    const remove = function(req, res) {
        const itemId = req.params.id;
        const userName = req.user.id;

        CartItem.deleteOne({ user: userName, itemId: itemId }).then((dbRes) => {
            console.log(dbRes)
            if (dbRes.deletedCount > 0) {
                endRequest(res, 204, null, null);
            } else {
                endRequest(res, 404, null, {
                    error: 'The given ordering item cannot ' + 'be deleted since it was not present in your cart'
                });
            }
        }).catch((err) => {
            endRequest(res, 500, null, { error: err.message });
        });
    };

    const empty = function(req, res) {
        const userName = req.user.id;

        CartItem.deleteMany({ user: userName }).then(() => {
            endRequest(res, 204, null, null);
        }).catch((err) => {
            endRequest(res, 500, null, { error: err.message });
        });
    };

    return {
        getCart: getCart,
        getItem: getItem,
        add: add,
        remove: remove,
        empty: empty
    };
})();

exports.shoppingCart = shoppingCart;
