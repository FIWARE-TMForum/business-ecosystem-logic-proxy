/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(ShoppingCartRouteConfig);

    function ShoppingCartRouteConfig($stateProvider, $injector) {

        if ($injector.has('LOGGED_USER')) {

            $stateProvider
                .state('shopping-cart', {
                    url: '/shopping-cart',
                    data: {
                        title: 'My Shopping Cart'
                    },
                    views: {
                        sidebar: {
                            template: '<ui-view>'
                        },
                        content: {
                            templateUrl: 'shopping-cart/list',
                            controller: 'CreateOrderCtrl as orderVM'
                        }
                    }
                });
        }
    }

})();
