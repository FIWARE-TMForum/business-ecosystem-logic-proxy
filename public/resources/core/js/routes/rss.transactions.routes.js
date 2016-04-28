/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(RSTransRouteConfig);

    function RSTransRouteConfig($stateProvider) {

        $stateProvider
            .state('rss.transactions', {
                url: '/transactions',
                templateUrl: 'rss/transactions/search',
                controller: 'RSTransSearchCtrl as searchVM'
            })
    }

})();
