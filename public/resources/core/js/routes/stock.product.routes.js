/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(ProductRouteConfig);

    function ProductRouteConfig($stateProvider, $injector) {

        if ($injector.has('LOGGED_USER')) {

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
                    templateUrl: 'stock/product/update/bundled'
                });
        }
    }

})();