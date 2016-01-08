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
                .state('inventory.order', {
                    url: '/order',
                    templateUrl: 'inventory/order/search'
                });
        }
    }

})();
