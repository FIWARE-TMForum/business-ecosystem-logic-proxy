/**
 * @author Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(UnauthorizedConfig);

    function UnauthorizedConfig($stateProvider) {

        $stateProvider
            .state('unauthorized', {
                url: '/unauthorized',
                data: {
                    title: 'Unauthorized'
                },
                params: {
                    'came_from': '/'
                },
                views: {
                    sidebar: {
                        controller: 'UnauthorizedCtrl as ctrl',
                        templateUrl: 'unauthorized'
                    },
                    content: {
                        template: '<ui-view>'
                    }
                }
            });
    }

})();
