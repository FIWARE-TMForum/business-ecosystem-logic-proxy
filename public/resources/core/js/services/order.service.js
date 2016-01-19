/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('Order', OrderService);

    function OrderService($q, $resource, URLS) {
        var resource = $resource(URLS.ORDERING + '/productOrder');

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
