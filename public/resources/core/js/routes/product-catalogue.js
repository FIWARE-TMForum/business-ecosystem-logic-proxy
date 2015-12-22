/**
 *
 */

angular.module('app')
    .config(function ($stateProvider, $injector) {

        $stateProvider
            .state('app.catalogue', {
                abstract: true,
                url: 'catalogue',
                template: '<ui-view/>',
                data: {
                    title: 'Catalogues'
                }
            })
            .state('app.catalogue.detail', {
                url: "/:catalogueId",
                templateUrl: "customer/product-catalogue/detail",
                controller: 'CatalogueDetailCtrl'
            })
            .state('app.catalogue.detail.offering', {
                url: "/offering?categoryId",
                templateUrl: "customer/product-offering/search",
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
                .state('app.stock.catalogue', {
                    url: '/catalogue?status&role',
                    templateUrl: 'seller/product-catalogue/search',
                    resolve: {
                        catalogueParams: function ($stateParams) {
                            return $stateParams;
                        },
                        catalogueFilters: function ($stateParams) {
                            return {
                                status: $stateParams.status ? $stateParams.status.split(',') : [],
                                role: $stateParams.role
                            };
                        }
                    },
                    controller: 'CatalogueSearchCtrl'
                })
                .state('app.stock.catalogue.create', {
                    url: '/create',
                    templateUrl: 'seller/product-catalogue/create',
                    controller: 'CatalogueCreateCtrl'
                })
                .state('app.stock.catalogue.update', {
                    url: '/:catalogueId',
                    templateUrl: 'seller/product-catalogue/update',
                    controller: 'CatalogueUpdateCtrl'
                })
                .state('app.stock.catalogue.update.party', {
                    url: '/party',
                    templateUrl: 'seller/product-catalogue/update/party'
                })
                .state('app.stock.catalogue.update.offering', {
                    url: '/offering?categoryId',
                    templateUrl: 'seller/product-catalogue/update/offering',
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
                });
        }
    });
