var shoppingCart = (function() {

    var carts = {};

    var endRequest = function(res, code, content) {
        res.statusCode = code;
        res.write(JSON.stringify(content));
        res.end();
    };

    var getCart = function(req, res) {

        var userName = req.user.id;
        var cart = carts[userName] ? carts[userName] : [];

        endRequest(res, 200, cart);
    };

    var getItem = function(req, res) {

        var userName = req.user.id;
        var cart = carts[userName] ? carts[userName] : [];

        var selectedItem = cart.filter(function(item) {
            return item.id == req.params.id;
        })[0];

        if (selectedItem) {
            endRequest(res, 200, selectedItem);
        } else {
            endRequest(res, 404, { error: 'The given ordering item does not exist in your cart' });
        }
    };

    var add = function(req, res) {

        var itemId = req.params.id;
        var userName = req.user.id;

        if (!(userName in carts)) {
            carts[userName] = [];
        }

        try {

            var newItem = JSON.parse(req.body);
            newItem.id = itemId;

            var itemsSameId = carts[userName].filter(function(item) {
                return item.id == itemId;
            });

            if (itemsSameId.length > 0) {
                endRequest(res, 409, { error: 'The shopping cart already contains this item' });
            } else {
                carts[userName].push(newItem);
                endRequest(res, 200, { status: 'ok' });
            }

        } catch (e) {
            endRequest(res, 400, { error: 'The given item is not valid' });
        }

    };

    var remove = function(req, res) {

        var userName = req.user.id;
        var itemId = req.params.id;
        var cart = carts[userName] ? carts[userName] : [];
        var cartPreviousLength = cart.length;

        carts[userName] = cart.filter(function(item) {
           return item.id != itemId;
        });

        if (cartPreviousLength === carts[userName].length) {
            endRequest(res, 404, { error: 'The given ordering item cannot be deleted since it was not present in your cart'});
        } else {
            endRequest(res, 200, { status: 'ok'});
        }

    };

    var empty = function(req, res) {

        var userName = req.user.id;
        carts[userName] = [];

        endRequest(res, 200, { status: 'ok' });
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