/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(RouteConfig);

    function RouteConfig($stateProvider, $injector) {

        if ($injector.has('LOGGED_USER')) {

            $stateProvider
                .state('inventory', {
                    url: '/inventory',
                    data: {
                        title: 'My Inventory'
                    },
                    views: {
                        sidebar: {
                            templateUrl: 'inventory/sidebar',
                            controller: InventoryController
                        },
                        content: {
                            template: '<ui-view>'
                        }
                    }
                });
        }
    }

    function InventoryController($state) {

        if ($state.is('inventory')) {
            $state.go('inventory.product');
        }
    }

})();
