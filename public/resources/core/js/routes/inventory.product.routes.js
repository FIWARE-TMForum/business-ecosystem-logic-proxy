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

    function RouteConfig($stateProvider) {

        $stateProvider
            .state('inventory.product', {
                url: '/product?status',
                params: {
                    customer: true,
                    flow: 1
                },
                data: {
                    filters: ['status'],
                },
                templateUrl: 'inventory/product/search',
                controller: 'InventorySearchCtrl as searchVM'

            })
            .state('inventory.product.detail', {
                url: '/:productId',
                templateUrl: 'inventory/product/detail',
                controller: 'InventoryDetailsCtrl as detailVM'
            });
    }

})();
