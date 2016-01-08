/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(StockRouteConfig);

    function StockRouteConfig($stateProvider, $injector) {

        if ($injector.has('LOGGED_USER')) {

            $stateProvider
                .state('stock', {
                    url: '/stock',
                    data: {
                        title: 'My Stock'
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
    }

    function StockController($state) {

        if ($state.is('stock')) {
            $state.go('stock.catalogue');
        }
    }

})();
