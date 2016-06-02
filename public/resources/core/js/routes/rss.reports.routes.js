/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(RouteConfig);

    function RouteConfig($stateProvider) {

        $stateProvider
            .state('rss.reports', {
                url: '/reports',
                templateUrl: 'rss/reports/search',
                controller: 'RSReportSearchCtrl as searchVM'
            });
    }

})();
