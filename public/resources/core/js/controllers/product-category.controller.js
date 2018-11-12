/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the business-ecosystem-logic-proxy of the
 * Business API Ecosystem
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

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
        .controller('CategoryBreadcrumbCtrl', ['$state', '$rootScope', 'EVENTS', 'Utils', 'Category', CategoryBreadcrumbController])
        .controller('CategorySearchCtrl', ['Category', 'PROMISE_STATUS', 'Utils', CategorySearchController])
        .controller('CategoryCreateCtrl', ['$state', '$rootScope', 'EVENTS', 'PROMISE_STATUS', 'Category', 'Utils', CategoryCreateController])
        .controller('CategoryUpdateCtrl', ['$state', '$rootScope', 'EVENTS', 'PROMISE_STATUS', 'Category', 'Utils', CategoryUpdateController]);

    function CategoryBreadcrumbController($state, $rootScope, EVENTS, Utils, Category) {
        /* jshint validthis: true */
        var vm = this;

        vm.list = [];
        vm.list.status = LOADING;

        if ($state.params.categoryId != null) {
            Category.detail($state.params.categoryId).then(function (categoryRetrieved) {
                vm.category = categoryRetrieved;
            });
        }

        Category.search($state.params).then(function (categoryList) {
            angular.copy(categoryList, vm.list);
            vm.list.status = LOADED;
        }, function (response) {
            vm.list.status = ERROR;
            $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                error: Utils.parseError(response, 'It was impossible to load the list of categories')
            });
        });
    }

    function CategorySearchController(Category, PROMISE_STATUS, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.STATUS = PROMISE_STATUS;
        vm.list = [];

        var searchPromise = Category.search({ all: true });

        searchPromise.then(function (categoryList) {
            angular.copy(categoryList, vm.list);
        }, function (response) {
            vm.errorMessage = Utils.parseError(response, 'Unexpected error trying to collect the categories.')
        });

        Object.defineProperty(vm, 'status', {
            get: function () { return searchPromise != null ? searchPromise.$$state.status : -1; }
        });
    }

    function CategoryCreateController($state, $rootScope, EVENTS, PROMISE_STATUS, Category, Utils) {
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
        var createPromise;

        vm.STATUS = PROMISE_STATUS;

        vm.data = Category.initiate();
        vm.stepList = stepList;

        vm.create = create;
        vm.refresh = refresh;
        vm.setCategory = setCategory;

        function refresh() {
            vm.data.parentId = null;
            vm.category = null;
        }

        function setCategory(category) {
            vm.data.parentId = category.id;
            vm.category = category;
        }

        function create() {
            createPromise = Category.create(vm.data);
            createPromise.then(function (categoryCreated) {
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

        Object.defineProperty(create, 'status', {
            get: function () { return createPromise != null ? createPromise.$$state.status : -1; }
        });
    }

    function CategoryUpdateController($state, $rootScope, EVENTS, PROMISE_STATUS, Category, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.STATUS = PROMISE_STATUS;

        vm.item = {};
        vm.update = update;

        var detailPromise = Category.detail($state.params.categoryId);
        var updatePromise = null;

        detailPromise.then(function (categoryRetrieved) {
            vm.data = angular.copy(categoryRetrieved);
            vm.item = categoryRetrieved;
        }, function (response) {
            vm.errorMessage = Utils.parseError(response, 'The requested category could not be retrieved');
        });

        Object.defineProperty(vm, 'status', {
            get: function () { return detailPromise != null ? detailPromise.$$state.status : -1; }
        });

        function update() {
            var updated = {};

            Category.PATCHEABLE_ATTRS.forEach((attr) => {
                if (!angular.equals(vm.item[attr], vm.data[attr])) {
                    updated[attr] = vm.data[attr];
                }
            });

            updatePromise = Category.update(vm.item.id, updated);
            updatePromise.then(function (categoryUpdated) {
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

        Object.defineProperty(update, 'status', {
            get: function () { return updatePromise != null ? updatePromise.$$state.status : -1; }
        });
    }

})();
