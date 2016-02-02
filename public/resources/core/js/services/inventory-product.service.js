/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('InventoryProduct', InventoryProductService);

    function InventoryProductService($q, $resource, URLS, User, Offering) {
        var resource = $resource(URLS.INVENTORY + '/product/:productId', {
            productId: '@id'
        });

        return {
            search: search,
            detail: detail
        };

        function search(filters) {
            var deferred = $q.defer();
            var params = {};

            if (!angular.isObject(filters)) {
                filters = {};
            }

            if(filters.customer) {
                params['relatedParty.id'] = User.loggedUser.id;
            }

            if (filters.status) {
                params['status'] = filters.status;
            }

            resource.query(params, function (productList) {
                if (productList.length) {
                    // Include offering with the product
                    var completeList = angular.copy(productList);
                    attachOfferingInfo(deferred, productList, completeList);
                } else {
                    deferred.resolve(productList);
                }
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;

            function attachOfferingInfo(deferred, productList, completeList) {
                // Get element to process
                var item = productList.shift();

                // Get offering info
                Offering.detail(item.productOffering.id).then(function(offeringInfo){
                    // Append offering information
                    completeList[completeList.length - productList.length - 1].productOffering = offeringInfo;

                    // If there are not more elements to process, return the product list
                    if (!productList.length) {
                        deferred.resolve(completeList);
                    } else {
                        // Process the rest of the list
                        attachOfferingInfo(deferred, productList, completeList);
                    }
                }, function(response){
                    deferred.reject(response);
                });
            }
        }

        function detail(productId) {
            var deferred = $q.defer();
            var params = {
                productId: productId
            };

            resource.get(params, function (product) {
                deferred.resolve(product);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }
    }
})();