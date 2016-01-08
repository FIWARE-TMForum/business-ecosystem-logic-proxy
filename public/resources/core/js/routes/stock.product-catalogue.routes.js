/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(CatalogueRouteConfig);

    function CatalogueRouteConfig($stateProvider, $injector) {

        if ($injector.has('LOGGED_USER')) {

            $stateProvider
                .state('stock.catalogue', {
                    url: '/catalogue?status&role',
                    params: {
                        owner: true
                    },
                    data: {
                        filters: ['status', 'role']
                    },
                    templateUrl: 'stock/product-catalogue/search',
                    controller: 'CatalogueSearchCtrl as searchVM'
                })
                .state('stock.catalogue.create', {
                    url: '/create',
                    templateUrl: 'stock/product-catalogue/create',
                    controller: 'CatalogueCreateCtrl as createVM'
                })
                .state('stock.catalogue.update', {
                    url: '/:catalogueId',
                    templateUrl: 'stock/product-catalogue/update',
                    controller: 'CatalogueUpdateCtrl as updateVM'
                })
                .state('stock.catalogue.update.party', {
                    url: '/party',
                    templateUrl: 'stock/product-catalogue/update/party'
                })
                .state('stock.catalogue.update.offering', {
                    url: '/offering?categoryId',
                    data: {
                        filters: ['status']
                    },
                    templateUrl: 'stock/product-catalogue/update/offering',
                    controller: 'OfferingSearchCtrl as searchVM'
                });
        }
    }

})();
