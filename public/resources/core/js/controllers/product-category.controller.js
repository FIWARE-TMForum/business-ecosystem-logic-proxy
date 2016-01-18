/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    var LOADING = 'LOADING';
    var LOADED = 'LOADED';
    var ERROR = 'ERROR';

    angular
        .module('app')
        .controller('CategorySearchCtrl', CategorySearchController)
        .controller('CategoryCreateCtrl', CategoryCreateController);

    function parseError(response, defaultMessage) {
        var data = response['data'];
        return data !== null && 'error' in data ? data['error'] : defaultMessage;
    }

    function CategorySearchController($state, Category, $rootScope, EVENTS) {
        /* jshint validthis: true */
        var vm = this;

        vm.breadcrumb = [];
        vm.list = [];
        vm.list.status = LOADING;

        Category.search($state.params).then(function (categoryList) {
            angular.copy(categoryList, vm.list);
            vm.list.status = LOADED;
        }, function (response) {

            vm.list.status = ERROR;

            $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                error: parseError(response, 'It was impossible to load the list of categories')
            });
        });

        Category.getBreadcrumbOf($state.params.categoryId).then(function (categoryList) {
            angular.copy(categoryList, vm.breadcrumb);
            vm.breadcrumb.loaded = true;
        });
    }

    function CategoryCreateController($state, $rootScope, EVENTS, Category) {
        /* jshint validthis: true */
        var vm = this;

        vm.breadcrumb = [];
        vm.list = [];

        vm.show = show;

        refresh();

        function show(categoryId) {
            vm.categoryId = categoryId;
            refresh();
        }

        function refresh() {
            vm.list.status = LOADING;

            Category.search({categoryId: vm.categoryId}).then(function (categoryList) {
                angular.copy(categoryList, vm.list);
                vm.list.status = LOADED;
            }, function (response) {
            });

            Category.getBreadcrumbOf(vm.categoryId).then(function (categoryList) {
                vm.breadcrumb = categoryList;
                vm.breadcrumb.loaded = true;
            });
        }
    }

})();
