/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(ProductRouteConfig);

    function ProductRouteConfig($stateProvider) {

        $stateProvider
            .state('stock.product', {
                url: '/product?status&type',
                params: {
                    owner: true,
                    flow: 1
                },
                data: {
                    filters: ['status', 'type']
                },
                templateUrl: 'stock/product/search',
                controller: 'ProductSearchCtrl as searchVM'
            })
            .state('stock.product.create', {
                url: '/create',
                templateUrl: 'stock/product/create',
                controller: 'ProductCreateCtrl as createVM'
            })
            .state('stock.product.update', {
                url: '/:productId',
                templateUrl: 'stock/product/update',
                controller: 'ProductUpdateCtrl as updateVM'
            })
            .state('stock.product.update.bundled', {
                url: '/bundled',
                params: {
                    flow: 1
                },
                templateUrl: 'stock/product/update/bundled'
            })
            .state('stock.product.update.attachment', {
                url: '/attachment',
                templateUrl: 'stock/product/update/attachment'
            })
            .state('stock.product.update.relationship', {
                url: '/relationship',
                templateUrl: 'stock/product/update/relationship'
            })
            .state('stock.product.update.characteristic', {
                url: '/characteristic',
                templateUrl: 'stock/product/update/characteristic'
            });;
    }

})();
