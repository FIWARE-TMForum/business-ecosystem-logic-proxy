/**
 *
 */

angular.module('app')
    .config(function ($stateProvider, $injector) {

        $stateProvider
            .state('app.offering', {
                url: 'offering?categoryId',
                templateUrl: 'customer/product-offering/search',
                data: {
                    title: 'Marketplace'
                },
                resolve: {
                    userRole: function (User) {
                        return User.ROLES.CUSTOMER;
                    },
                    offeringFilters: function ($stateParams) {
                        return {};
                    }
                },
                controller: 'OfferingSearchCtrl'
            });

        if ($injector.has('LOGGED_USER')) {

            $stateProvider
                .state('app.stock.offering', {
                    url: '/offering?status',
                    templateUrl: 'seller/product-offering/search',
                    resolve: {
                        userRole: function (User) {
                            return User.ROLES.SELLER;
                        },
                        offeringFilters: function ($stateParams) {
                            return {
                                status: $stateParams.status ? $stateParams.status.split(',') : []
                            };
                        }
                    },
                    controller: 'OfferingSearchCtrl'
                })
                .state('app.stock.offering.create', {
                    url: '/create',
                    templateUrl: 'seller/product-offering/create',
                    controller: 'OfferingCreateCtrl'
                })
                .state('app.stock.offering.create.product', {
                    url: '/product',
                    templateUrl: 'seller/product-offering/create/product',
                    resolve: {
                        productParams: function ($stateParams, LIFECYCLE_STATUS) {
                            return {
                                status: [LIFECYCLE_STATUS.ACTIVE, LIFECYCLE_STATUS.LAUNCHED].join()
                            };
                        },
                        productFilters: function ($stateParams) {
                            return {};
                        }
                    },
                    controller: 'ProductSearchCtrl'
                })
                .state('app.stock.offering.create.catalogue', {
                    url: '/catalogue',
                    templateUrl: 'seller/product-offering/create/catalogue',
                    resolve: {
                        catalogueParams: function ($stateParams, LIFECYCLE_STATUS) {
                            return {
                                status: [LIFECYCLE_STATUS.ACTIVE, LIFECYCLE_STATUS.LAUNCHED].join()
                            };
                        },
                        catalogueFilters: function ($stateParams) {
                            return {};
                        }
                    },
                    controller: 'CatalogueSearchCtrl'
                })
                .state('app.stock.offering.create.pricing', {
                    url: '/pricing',
                    templateUrl: 'seller/product-offering/create/pricing'
                })
                .state('app.stock.offering.create.finish', {
                    url: '/finish',
                    templateUrl: 'seller/product-offering/create/finish'
                })
                .state('app.stock.offering.update', {
                    url: '/:offeringId',
                    templateUrl: 'seller/product-offering/update',
                    controller: 'OfferingUpdateCtrl'
                });
        }
    });
