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
                controller: function RedirectController($state) {
                    if ($state.is('settings.contact')) {
                        $state.go('settings.contact.shipping');
                    }
                }
            })
            .state('settings.contact.shipping', {
                url: '/shipping',
                templateUrl: 'settings/contact/shipping/update',
                controller: 'CustomerSearchCtrl as searchVM'
            })
            .state('settings.contact.business', {
                url: '/business',
                templateUrl: 'settings/contact/business/update',
                controller: 'IndividualUpdateCtrl as updateVM'
            });
    }

})();
