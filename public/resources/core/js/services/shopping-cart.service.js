
/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('ShoppingCart', ShoppingCartService);

    function ShoppingCartService($q, $resource, URLS) {

        var resource = $resource(URLS.SHOPPING_CART, {
            id: '@id',
            action: '@action'
        });

        return {
            addItem: addItem,
            removeItem: removeItem,
            getItems: getItems,
            cleanItems: cleanItems
        };

        function addItem(item) {

            var deferred = $q.defer();

            resource.save({ action: 'item', id: item.id }, item, function () {
                deferred.resolve({});
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function removeItem(item) {

            var deferred = $q.defer();

            resource.delete({ action: 'item', id: item.id }, function () {
                deferred.resolve({});
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function getItems() {

            var deferred = $q.defer();

            resource.query({ action: 'item' }, function (items) {
                deferred.resolve(items);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function cleanItems() {

            var deferred = $q.defer();

            resource.delete({ action: 'empty' }, function () {
                deferred.resolve({});
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }
    }
})();

