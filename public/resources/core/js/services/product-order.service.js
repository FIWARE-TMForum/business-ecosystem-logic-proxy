/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('ProductOrder', ProductOrderService);

    function ProductOrderService($q, $resource, URLS, User, Offering) {
        var resource = $resource(URLS.PRODUCTORDER_MANAGEMENT + '/productOrder/:productOrderId', {
            productOrderId: '@id'
        });

        return {
            create: create
        };

        function create(orderInfo) {
            var deferred = $q.defer();

            resource.save(orderInfo, function (orderCreated, getResponseHeaders) {
                deferred.resolve({
                    order: orderCreated,
                    headers:getResponseHeaders()
                });
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }
    }

})();
