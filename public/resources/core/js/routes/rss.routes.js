/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(RSSRouteConfig);

    function RSSRouteConfig($stateProvider) {

        $stateProvider
            .state('rss', {
                url: '/rss',
                data: {
                    title: 'Revenue Sharing',
                    loggingRequired: true
                },
                views: {
                    'sidebar-content': {
                        templateUrl: 'rss/sidebar',
                        controller: RSSController
                    },
                    'content': {
                        template: '<ui-view>'
                    }
                }
            });
    }

    function RSSController($state) {

        if ($state.is('rss')) {
            $state.go('rss.models');
        }
    }

})();
