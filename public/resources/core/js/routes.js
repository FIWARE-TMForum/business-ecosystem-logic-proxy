/**
 *
 */

angular.module('app')
    .config(function ($stateProvider, $urlRouterProvider, $injector) {

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
            })
            .state('app.payment', {
                url: 'payment',
                    data: {
                        title: 'Payment'
                    },
                views: {
                    content: {
                        templateUrl: 'payment/content',
                        controller: 'PaymentController'
                    }
                }
            });

        if ($injector.has('LOGGED_USER')) {

            $stateProvider
                .state('app.stock', {
                    url: 'stock',
                    data: {
                        title: 'My Stock'
                    },
                    views: {
                        sidebar: {
                            templateUrl: 'stock/sidebar',
                            controller: function ($state) {
                                $state.go('app.stock.catalogue');
                            }
                        },
                        content: {
                            template: '<ui-view/>'
                        }
                    }
                })
                .state('app.inventory', {
                    url: 'inventory',
                    data: {
                        title: 'My Inventory'
                    },
                    views: {
                        sidebar: {
                            templateUrl: 'inventory/sidebar',
                            controller: function ($state) {
                                $state.go('app.inventory.order');
                            }
                        },
                        content: {
                            template: '<ui-view/>'
                        }
                    }
                });
        }
    });
