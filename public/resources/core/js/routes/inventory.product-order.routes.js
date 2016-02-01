/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */


(function () {

    'use strict';

    angular
        .module('app')
        .config(RouteConfig);

    function RouteConfig($stateProvider, $injector) {

        if ($injector.has('LOGGED_USER')) {

            $stateProvider
                .state('inventory.productOrder', {
                    url: '/product-order?status',
                    params: {
                        owner: true,
                        role: 'Customer'
                    },
                    data: {
                        filters: ['status']
                    },
                    templateUrl: 'inventory/product-order/search',
                    controller: 'ProductOrderSearchCtrl as searchVM'
                })
                .state('inventory.productOrder.detail', {
                    url: '/:productOrderId',
                    templateUrl: 'inventory/product-order/detail',
                    controller: 'ProductOrderDetailCtrl as detailVM'
                });
        }
    }

})();
