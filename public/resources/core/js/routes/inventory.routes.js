/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(RouteConfig);

    function RouteConfig($stateProvider) {

        $stateProvider
            .state('inventory', {
                url: '/inventory',
                data: {
                    title: 'My Inventory',
                    loggingRequired: true
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

    function InventoryController($state) {

        if ($state.is('inventory')) {
            $state.go('inventory.product');
        }
    }

})();
