/**
 *
 */

angular.module('app')
    .config(function ($stateProvider, $urlRouterProvider, $injector) {

        $urlRouterProvider.otherwise('/offering');

        $stateProvider
            .state('app', {
                abstract: true,
                url: '/',
                templateUrl: 'content',
                controller: function ($scope, LIFECYCLE_STATUS) {

                    $scope.LIFECYCLE_STATUS = LIFECYCLE_STATUS;

                    $scope.$on("$stateChangeSuccess", function (event, toState) {
                        $scope.title = toState.data.title;
                    });
                }
            });

        if ($injector.has('LOGGED_USER')) {

            $stateProvider
                .state('app.stock', {
                    abstract: true,
                    url: 'stock',
                    template: '<ui-view/>',
                    data: {
                        title: 'My Stock'
                    }
                });
        }
    });
