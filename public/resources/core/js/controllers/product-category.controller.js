/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .controller('CategorySearchCtrl', CategorySearchController);

    function CategorySearchController($state, Category) {
        /* jshint validthis: true */
        var vm = this;

        vm.breadcrumb = [];
        vm.list = [];

        Category.search($state.params).then(function (categoryList) {
            angular.copy(categoryList, vm.list);
            vm.list.loaded = true;
        });

        Category.getBreadcrumbOf($state.params.categoryId).then(function (categoryList) {
            angular.copy(categoryList, vm.breadcrumb);
            vm.breadcrumb.loaded = true;
        });
    }

})();
