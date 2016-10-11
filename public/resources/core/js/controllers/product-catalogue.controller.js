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
        .controller('CatalogueListCtrl', CatalogueListController)
        .controller('CatalogueSearchCtrl', CatalogueSearchController)
        .controller('CatalogueCreateCtrl', CatalogueCreateController)
        .controller('CatalogueDetailCtrl', CatalogueDetailController)
        .controller('CatalogueUpdateCtrl', CatalogueUpdateController);

    function CatalogueListController($scope, Catalogue, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.list = [];
        vm.offset = -1;
        vm.size = -1;
        vm.getElementsLength = getElementsLength;

        function getElementsLength() {
            return Catalogue.count();
        }

        $scope.$watch(function () {
            return vm.offset;
        }, function () {
            vm.list.status = LOADING;

            if (vm.offset >= 0) {
                var page = {
                    offset: vm.offset,
                    size: vm.size
                };

                Catalogue.search(page).then(function (catalogueList) {
                    angular.copy(catalogueList, vm.list);
                    vm.list.status = LOADED;
                }, function (response) {
                    vm.error = Utils.parseError(response, 'It was impossible to load the list of catalogs');
                    vm.list.status = ERROR;
                });
            }
        });
    }

    function CatalogueSearchController($scope, $state, $rootScope, EVENTS, Catalogue, LIFECYCLE_STATUS, DATA_STATUS, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.STATUS = DATA_STATUS;
        vm.state = $state;

        vm.offset = -1;
        vm.size = -1;
        vm.list = [];

        vm.showFilters = showFilters;
        vm.getElementsLength = getElementsLength;

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, LIFECYCLE_STATUS);
        }

        function getElementsLength() {
            var params = {};
            angular.copy($state.params, params);
            return Catalogue.count(params);
        }

        vm.list.status = vm.STATUS.LOADING;
        $scope.$watch(function () {
            return vm.offset;
        }, function () {
            vm.list.status = vm.STATUS.LOADING;

            if (vm.offset >= 0) {
                var params = {};
                angular.copy($state.params, params);

                params.offset = vm.offset;
                params.size = vm.size;

                Catalogue.search(params).then(function (catalogueList) {
                    angular.copy(catalogueList, vm.list);
                    vm.list.status = vm.STATUS.LOADED;
                }, function (response) {
                    vm.errorMessage = Utils.parseError(response, 'It was impossible to load the list of catalogs');
                    vm.list.status = vm.STATUS.ERROR;
                });
            }
        });
    }

    function CatalogueCreateController($state, $rootScope, EVENTS, PROMISE_STATUS, Catalogue, Utils) {
        /* jshint validthis: true */
        var vm = this;
        var createPromise = null;
        var stepList = [
            {
                title: 'General',
                templateUrl: 'stock/product-catalogue/create/general'
            },
            {
                title: 'Finish',
                templateUrl: 'stock/product-catalogue/create/finish'
            }
        ];

        vm.STATUS = PROMISE_STATUS;

        vm.data = Catalogue.buildInitialData();
        vm.stepList = stepList;

        vm.create = create;

        function create() {
            createPromise = Catalogue.create(vm.data);
            createPromise.then(function (catalogueCreated) {
                $state.go('stock.catalogue.update', {
                    catalogueId: catalogueCreated.id
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                    resource: 'catalog',
                    name: catalogueCreated.name
                });
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to create the product catalog.')
                });
            });
        }

        Object.defineProperty(create, 'status', {
            get: function () { return createPromise != null ? createPromise.$$state.status : -1; }
        });
    }

    function CatalogueDetailController($state, Catalogue, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.item = {};

        vm.catalogueId = $state.params.catalogueId;

        if (vm.catalogueId) {
            Catalogue.detail(vm.catalogueId).then(function (catalogueRetrieved) {
                vm.item = catalogueRetrieved;
                vm.item.status = LOADED;
            }, function (response) {
                vm.error = Utils.parseError(response, 'The requested catalog could not be retrieved');
                vm.item.status = ERROR;
            });
        }
    }

    function CatalogueUpdateController($state, $rootScope, EVENTS, PROMISE_STATUS, Catalogue, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.update = update;
        vm.updateStatus = updateStatus;

        vm.STATUS = PROMISE_STATUS;

        vm.item = {};

        var detailPromise = Catalogue.detail($state.params.catalogueId);
        var updatePromise = null;

        detailPromise.then(function (catalogueRetrieved) {
            vm.data = angular.copy(catalogueRetrieved);
            vm.item = catalogueRetrieved;
        }, function (response) {
            vm.errorMessage = Utils.parseError(response, 'The requested catalog could not be retrieved');
        });

        Object.defineProperty(vm, 'status', {
            get: function () { return detailPromise != null ? detailPromise.$$state.status : -1; }
        });

        function updateStatus(status) {
            vm.data.lifecycleStatus = status;
            vm.statusUpdated = true;
        }

        function update() {
            updatePromise = Catalogue.update(vm.data);
            updatePromise.then(function (catalogueUpdated) {
                $state.go('stock.catalogue.update', {
                    catalogueId: catalogueUpdated.id
                }, {
                    reload: true
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                    resource: 'catalog',
                    name: catalogueUpdated.name
                });
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to update the product catalog.')
                });
            });
        }

        Object.defineProperty(update, 'status', {
            get: function () { return updatePromise != null ? updatePromise.$$state.status : -1; }
        });
    }

})();
