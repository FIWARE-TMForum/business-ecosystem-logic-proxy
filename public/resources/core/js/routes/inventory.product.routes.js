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
                    filters: ['status']
                },
                templateUrl: 'inventory/product/search',
                controller: 'InventorySearchCtrl as searchVM'

            })
            .state('inventory.product.detail', {
                url: '/:productId',
                templateUrl: 'inventory/product/detail',
                controller: 'InventoryDetailsCtrl as detailVM'
            })
            .state('inventory.product.detail.productCharacteristic', {
                url: '/characteristic',
                templateUrl: 'inventory/product/detail/characteristic'
            })
            .state('inventory.product.detail.productPrice', {
                url: '/priceplan',
                templateUrl: 'inventory/product/detail/priceplan'
            })
            .state('inventory.product.detail.usage', {
                url: '/usage',
                templateUrl: 'inventory/product/detail/usage'
            });
    }

})();
