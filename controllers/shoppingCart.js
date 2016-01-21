var CartItem = require('../db/schemas/cartItem');

var connection = mongoose.connect('mongodb://localhost:27017/shoppingCartItems');

var shoppingCart = (function() {



    var endRequest = function(res, code, content) {
        res.statusCode = code;
        res.json(content);
        res.end();
    };

    var getCart = function(req, res) {

        var userName = req.user.id;

        CartItem.find({ user: userName }, function(err, result) {

            if (err) {
                endRequest(res, 500, err);
            } else {

                var items = [];

                result.forEach(function(cartItem) {
                    items.push(cartItem.itemObject);
                });

                endRequest(res, 200, items);
            }
        });
    };

    var getItem = function (req, res) {

        var userName = req.user.id;
        var itemId = req.params.id;

        CartItem.findOne({ user: userName, itemId: itemId }, function(err, result) {

            if (err) {
                endRequest(res, 500, err);
            } else {
                if (result) {
                    endRequest(res, 200, result.itemObject);
                } else {
                    endRequest(res, 404, { error: 'Item not found in your cart' });
                }
            }

        });
    };

    var add = function(req, res) {

        var itemId = req.params.id;
        var userName = req.user.id;

        try {
            var item = new CartItem();
            item.user = userName;
            item.itemId = itemId;
            item.itemObject = JSON.parse(req.body);
            item.itemObject.id = itemId;

            item.save(function (err) {
                if (err) {
                    endRequest(res, 404, err);
                } else {
                    endRequest(res, 200, {status: 'ok'});
                }
            });
        } catch (e) {
            endRequest(res, 400, { error: 'Invalid Cart Item' });
        }
    };

    var remove = function(req, res) {

        var itemId = req.params.id;
        var userName = req.user.id;

        CartItem.remove({ user: userName, itemId: itemId }, function(err, dbRes) {

            if (err) {
                endRequest(res, 500, err);
            } else {

                if (dbRes.result['n'] > 0) {
                    endRequest(res, 200, { status: 'ok' });
                } else {
                    endRequest(res, 404, { error: 'The given ordering item cannot be deleted since it was not present in your cart'})
                }
            }
        });

    };

    var empty = function(req, res) {

        var userName = req.user.id;

        CartItem.remove({ user: userName }, function(err, result) {

            if (err) {
                endRequest(res, 500, err);
            } else {
                endRequest(res, 200, { status: 'ok' });
            }

        });
    };

    return {
        getCart: getCart,
        getItem: getItem,
        add: add,
        remove: remove,
        empty: empty
    }

})();

exports.shoppingCart = shoppingCart;