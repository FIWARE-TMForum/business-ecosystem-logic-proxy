/**
 *
 */

angular.module('app')
    .config(function ($stateProvider, $injector) {

        if ($injector.has('LOGGED_USER')) {

            $stateProvider
                .state('app.stock.product', {
                    url: '/product?status',
                    templateUrl: 'seller/product/search',
                    resolve: {
                        productParams: function ($stateParams) {
                            return $stateParams;
                        },
                        productFilters: function ($stateParams) {
                            return {
                                status: $stateParams.status ? $stateParams.status.split(',') : []
                            };
                        }
                    },
                    controller: 'ProductSearchCtrl'
                })
                .state('app.stock.product.create', {
                    url: '/create',
                    templateUrl: 'seller/product/create',
                    controller: 'ProductCreateCtrl'
                })
                .state('app.stock.product.create.assets', {
                    url: '/assets',
                    templateUrl: 'seller/product/create/assets'
                })
                .state('app.stock.product.create.chars', {
                    url: '/chars',
                    templateUrl: 'seller/product/create/chars'
                })
                .state('app.stock.product.create.attachments', {
                    url: '/attachments',
                    templateUrl: 'seller/product/create/attachments'
                })
                .state('app.stock.product.create.finish', {
                    url: '/finish',
                    templateUrl: 'seller/product/create/finish'
                })
                .state('app.stock.product.update', {
                    url: '/:productId',
                    templateUrl: 'seller/product/update',
                    controller: 'ProductUpdateCtrl'
                });
        }
    });
