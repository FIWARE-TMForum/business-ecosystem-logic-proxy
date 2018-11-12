/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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

/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('ShoppingCart', ['$q', '$resource', 'URLS', 'Offering', ShoppingCartService]);

    function ShoppingCartService($q, $resource, URLS, Offering) {

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

            resource.save({ action: 'item', id: '' }, item, function () {
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

            resource.query({ action: 'item' }, function (itemList) {
                var items = {};
                var params = {
                    id: itemList.map(function (item) {
                        items[item.id] = item;
                        return item.id;
                    }).join()
                };

                if (itemList.length) {
                    Offering.search(params).then(function (productOfferingList) {
                        productOfferingList.forEach(function (productOffering) {
                            items[productOffering.id].pricePlan = new Offering.PricePlan(items[productOffering.id].options.pricing);
                            items[productOffering.id].productOffering = productOffering;
                        });
                        deferred.resolve(itemList);
                    }, function (response) {
                        deferred.reject(response);
                    });
                } else {
                    deferred.resolve(itemList);
                }
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function cleanItems() {

            var deferred = $q.defer();

            // Save makes post requests!!
            resource.save({ action: 'empty' }, function () {
                deferred.resolve({});
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }
    }
})();

