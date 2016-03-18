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
            .state('settings', {
                url: '/settings',
                data: {
                    title: 'Settings',
                    loggingRequired: true
                },
                views: {
                    'sidebar@': {
                        templateUrl: 'settings/sidebar',
                        controller: function RedirectController($state) {

                            if ($state.is('settings')) {
                                $state.go('settings.general');
                            }
                        }
                    },
                    'content@': {
                        template: '<ui-view>'
                    }
                }
            })
            .state('settings.general', {
                url: '/general',
                templateUrl: 'settings/general/update',
                controller: 'IndividualUpdateCtrl as updateVM'
            })
            .state('settings.contact', {
                url: '/contact',
                templateUrl: 'settings/contact/update',
                controller: 'IndividualUpdateCtrl as updateVM'
            });
    }

})();
