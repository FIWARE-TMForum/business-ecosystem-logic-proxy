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
        .controller('CategorySearch2Ctrl', CategorySearch2Controller)
        .controller('CategoryCreateCtrl', CategoryCreateController)
        .controller('CategoryUpdateCtrl', CategoryUpdateController);

    function CategorySearchController($state, Category, $rootScope, EVENTS, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.breadcrumb = [];
        vm.list = [];
        vm.list.status = LOADING;

        vm.roots = Category.dataCached.roots;
        vm.subcategories = Category.dataCached.subcategories;

        vm.getBreadcrumbOf = getBreadcrumbOf;

        Category.search($state.params).then(function (categoryList) {
            angular.copy(categoryList, vm.list);
            vm.list.status = LOADED;
        }, function (response) {

            vm.list.status = ERROR;

            $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                error: Utils.parseError(response, 'It was impossible to load the list of categories')
            });
        });

        function getBreadcrumbOf(category) {
            var breadcrumb = [];

            if (category.id in vm.subcategories) {
                findParent(category.parentId);
            }

            return breadcrumb;

            function findParent(categoryId) {

                if (categoryId in vm.roots) {
                    breadcrumb.unshift(vm.roots[categoryId]);
                } else {
                    breadcrumb.unshift(vm.subcategories[categoryId]);
                    findParent(vm.subcategories[categoryId].parentId);
                }
            }
        }

        Category.getBreadcrumbOf($state.params.categoryId).then(function (categoryList) {
            angular.copy(categoryList, vm.breadcrumb);
            vm.breadcrumb.loaded = true;
        });
    }

    function CategorySearch2Controller($state, $rootScope, EVENTS, Category) {
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

    function CategoryCreateController($scope, $state, $rootScope, EVENTS, Category, Utils) {
        /* jshint validthis: true */
        var vm = this;
        var stepList = [
            {
                title: 'General',
                templateUrl: 'admin/product-category/create/general'
            },
            {
                title: 'Finish',
                templateUrl: 'admin/product-category/create/finish'
            }
        ];

        vm.data = Category.initiate();
        vm.stepList = stepList;

        vm.create = create;
        vm.getBreadcrumbOf = getBreadcrumbOf;
        vm.refreshCategories = refreshCategories;
        vm.setRootCategory = setRootCategory;

        vm.roots = Category.dataCached.roots;
        vm.subcategories = Category.dataCached.subcategories;

        function refreshCategories() {
            if (!vm.data.isRoot) {
                vm.status = LOADING;
                Category.search({ admin: true }).then(function (categoryList) {
                    vm.status = LOADED;
                });
            }
            vm.data.parentId = null;
            vm.rootCategory = null;
        }

        function setRootCategory(category) {
            vm.data.parentId = category.id;
            vm.rootCategory = category;
        }

        function getBreadcrumbOf(category) {
            var breadcrumb = [];

            if (category != null && category.id in vm.subcategories) {
                findParent(category.parentId);
            }

            return breadcrumb;

            function findParent(categoryId) {

                if (categoryId in vm.roots) {
                    breadcrumb.unshift(vm.roots[categoryId]);
                } else {
                    breadcrumb.unshift(vm.subcategories[categoryId]);
                    findParent(vm.subcategories[categoryId].parentId);
                }
            }
        }

        function create() {
            Category.create(vm.data).then(function (categoryCreated) {
                $state.go('admin.productCategory.update', {
                    categoryId: categoryCreated.id
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                    resource: 'category',
                    name: categoryCreated.name
                });
            }, function (response) {

                var defaultMessage = 'There was an unexpected error that prevented the ' +
                    'system from creating a new category';
                var error = Utils.parseError(response, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            });
        }
    }

    function CategoryUpdateController($state, $rootScope, EVENTS, Category, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.item = {};
        vm.update = update;

        Category.detail($state.params.categoryId).then(function (categoryRetrieved) {
            vm.data = angular.copy(categoryRetrieved);
            vm.item = categoryRetrieved;
            vm.item.status = LOADED;
        }, function (response) {
            vm.error = Utils.parseError(response, 'The requested category could not be retrieved');
            vm.item.status = ERROR;
        });

        function update() {
            Category.update(vm.data).then(function (categoryUpdated) {
                $state.go('admin.productCategory.update', {
                    categoryId: categoryUpdated.id
                }, {
                    reload: true
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                    resource: 'category',
                    name: categoryUpdated.name
                });
            }, function (response) {

                var defaultMessage = 'There was an unexpected error that prevented the ' +
                    'system from updating the given category';
                var error = Utils.parseError(response, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            });
        }
    }

})();
