/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the bae-logic-proxy-test of the
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

var CartItem = require('../db/schemas/cartItem');

var shoppingCart = (function() {

    var endRequest = function(res, code, headers, content) {

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

    var getCart = function(req, res) {

        var userName = req.user.id;

        CartItem.find({ user: userName }, function(err, result) {

            if (err) {
                endRequest(res, 500, null, { error: err.message });
            } else {

                var items = [];

                result.forEach(function(cartItem) {
                    items.push(cartItem.itemObject);
                });

                endRequest(res, 200, null, items);
            }
        });
    };

    var getItem = function (req, res) {

        var userName = req.user.id;
        var itemId = req.params.id;

        CartItem.findOne({ user: userName, itemId: itemId }, function(err, result) {

            if (err) {
                endRequest(res, 500, null, { error: err.message });
            } else {
                if (result) {
                    endRequest(res, 200, null, result.itemObject);
                } else {
                    endRequest(res, 404, null, { error: 'Item not found in your cart' });
                }
            }

        });
    };

    var add = function(req, res) {

        var userName = req.user.id;

        try {

            var item = new CartItem();
            item.user = userName;
            item.itemObject = JSON.parse(req.body);

            var itemId = item.itemObject.id;

            if (itemId) {

                item.itemId = itemId;

                item.save(function (err) {

                    if (err) {

                        if (err.code === 11000) {
                            // duplicate key
                            endRequest(res, 409, null, { error: 'This item is already in your shopping cart' });
                        } else {
                            // other errors
                            endRequest(res, 500, null, { error: err.message });
                        }

                    } else {

                        var slash = req.url.slice(-1) === '/' ? '' : '/';
                        var headers = { 'location': req.url + slash + itemId };
                        endRequest(res, 201, headers, {status: 'ok'});
                    }
                });

            } else {
                endRequest(res, 400, null, { error: 'Cart Item ID missing' });
            }

        } catch (e) {
            endRequest(res, 400, null, { error: 'Invalid Cart Item' });
        }
    };

    var remove = function(req, res) {

        var itemId = req.params.id;
        var userName = req.user.id;

        CartItem.remove({ user: userName, itemId: itemId }, function(err, dbRes) {

            if (err) {
                endRequest(res, 500, null, { error: err.message });
            } else {

                if (dbRes.result['n'] > 0) {
                    endRequest(res, 204, null, null);
                } else {
                    endRequest(res, 404, null, { error: 'The given ordering item cannot ' +
                                                    'be deleted since it was not present in your cart'});
                }
            }
        });

    };

    var empty = function(req, res) {

        var userName = req.user.id;

        CartItem.remove({ user: userName }, function(err, result) {

            if (err) {
                endRequest(res, 500, null, { error: err.message });
            } else {
                endRequest(res, 204, null, null);
            }

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