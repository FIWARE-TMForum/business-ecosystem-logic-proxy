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
            .state('admin.productCategory', {
                url: '/category',
                params: {
                    admin: true
                },
                views: {
                    'admin-content': {
                        templateUrl: 'admin/product-category/search',
                        controller: 'CategorySearchCtrl as searchVM'
                    }
                }
            })
            .state('admin.productCategory.create', {
                url: '/create',
                templateUrl: 'admin/product-category/create',
                controller: 'CategoryCreateCtrl as createVM'
            })
            .state('admin.productCategory.update', {
                url: '/:categoryId',
                templateUrl: 'admin/product-category/update',
                controller: 'CategoryUpdateCtrl as updateVM'
            });
    }

})();
