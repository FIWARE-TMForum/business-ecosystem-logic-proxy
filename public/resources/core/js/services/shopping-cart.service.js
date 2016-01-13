
/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('ShoppingCart', ShoppingCartService);

    function ShoppingCartService() {
        var orderItems = [];

        var getIndexOf = function getIndexOf(item) {
            var i, index = -1;

            for (i = 0; i < orderItems.length && index === -1; i++) {
                if (orderItems[i].id === item.id) {
                    index = i;
                }
            }

            return index;
        };

        return {
            containsItem: containsItem,
            addItem: addItem,
            removeItem: removeItem,
            getItems: getItems,
            cleanItems: cleanItems
        };


        function containsItem(item) {
            return getIndexOf(item) !== -1;
        }

        function addItem(item) {
            if (!containsItem(item)) {
                orderItems.push(item);
            }
        }

        function removeItem(item) {
            if (containsItem(item)) {
                orderItems.splice(getIndexOf(item), 1);
            }
        }

        function getItems() {
            return orderItems;
        }

        function cleanItems() {
            orderItems = [];
        }
    }
})();

