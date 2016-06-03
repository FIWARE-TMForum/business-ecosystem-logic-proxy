/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
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
        .controller('CategoryBreadcrumbCtrl', CategoryBreadcrumbController)
        .controller('CategorySearchCtrl', CategorySearchController)
        .controller('CategoryCreateCtrl', CategoryCreateController)
        .controller('CategoryUpdateCtrl', CategoryUpdateController);

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

    function CategorySearchController($state, Category, $rootScope, EVENTS, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.list = [];
        vm.list.status = LOADING;

        Category.search({ all: true }).then(function (categoryList) {
            angular.copy(categoryList, vm.list);
            vm.list.status = LOADED;
        }, function (response) {
            vm.list.status = ERROR;
            vm.error = Utils.parseError(response, 'It was impossible to load the list of categories')
        });
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
