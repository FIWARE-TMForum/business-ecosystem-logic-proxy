/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(StockRouteConfig);

    function StockRouteConfig($stateProvider) {

        $stateProvider
            .state('stock', {
                url: '/stock',
                data: {
                    title: 'My Stock',
                    loggingRequired: true
                },
                views: {
                    sidebar: {
                        templateUrl: 'stock/sidebar',
                        controller: StockController
                    },
                    content: {
                        template: '<ui-view>'
                    }
                }
            });
    }

    function StockController($state) {

        if ($state.is('stock')) {
            $state.go('stock.catalogue');
        }
    }

})();
