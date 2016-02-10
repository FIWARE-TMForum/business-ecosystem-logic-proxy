/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(OfferingRouteConfig);

    function OfferingRouteConfig($stateProvider) {

        $stateProvider
            .state('stock.offering', {
                url: '/offering?status&type',
                params: {
                    owner: true,
                    flow: 1
                },
                data: {
                    filters: ['status', 'type']
                },
                templateUrl: 'stock/product-offering/search',
                controller: 'OfferingSearchCtrl as searchVM'
            })
            .state('stock.offering.create', {
                url: '/create',
                templateUrl: 'stock/product-offering/create',
                controller: 'OfferingCreateCtrl as createVM'
            })
            .state('stock.offering.update', {
                url: '/:offeringId',
                templateUrl: 'stock/product-offering/update',
                controller: 'OfferingUpdateCtrl as updateVM'
            })
            .state('stock.offering.update.product', {
                url: '/product',
                templateUrl: 'stock/product-offering/update/product'
            })
            .state('stock.offering.update.pricing', {
                url: '/pricing',
                templateUrl: 'stock/product-offering/update/pricing'
            })
            .state('stock.offering.update.category', {
                url: '/category',
                templateUrl: 'stock/product-offering/update/category'
            });
    }

})();
