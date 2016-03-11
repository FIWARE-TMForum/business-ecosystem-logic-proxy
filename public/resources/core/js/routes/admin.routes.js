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
            .state('admin', {
                url: '/admin',
                data: {
                    title: 'Administration',
                    loggingRequired: true
                },
                views: {
                    sidebar: {
                        templateUrl: 'admin/sidebar',
                        controller: AdminController
                    },
                    content: {
                        template: '<ui-view name="admin-content">'
                    }
                }
            });
    }

    function AdminController($state) {

        if ($state.is('admin')) {
            $state.go('admin.productCategory');
        }
    }

})();
