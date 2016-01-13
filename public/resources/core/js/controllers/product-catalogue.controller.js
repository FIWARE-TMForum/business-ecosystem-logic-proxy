/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .controller('CatalogueListCtrl', CatalogueListController)
        .controller('CatalogueSearchCtrl', CatalogueSearchController)
        .controller('CatalogueCreateCtrl', CatalogueCreateController)
        .controller('CatalogueDetailCtrl', CatalogueDetailController)
        .controller('CatalogueUpdateCtrl', CatalogueUpdateController);

    function CatalogueListController(Catalogue) {
        /* jshint validthis: true */
        var vm = this;

        vm.list = [];

        Catalogue.search().then(function (catalogueList) {
            angular.copy(catalogueList, vm.list);
            vm.list.loaded = true;
        });
    }

    function CatalogueSearchController($state, $rootScope, EVENTS, Catalogue) {
        /* jshint validthis: true */
        var vm = this;

        vm.state = $state;

        vm.list = [];

        vm.showFilters = showFilters;

        Catalogue.search($state.params).then(function (catalogueList) {
            angular.copy(catalogueList, vm.list);
            vm.list.loaded = true;
        });

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED);
        }
    }

    function CatalogueCreateController($state, $rootScope, EVENTS, Catalogue) {
        /* jshint validthis: true */
        var vm = this;
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

        vm.data = Catalogue.buildInitialData();
        vm.stepList = stepList;

        vm.create = create;

        function create() {
            Catalogue.create(vm.data).then(function (catalogueCreated) {
                $state.go('stock.catalogue.update', {
                    catalogueId: catalogueCreated.id
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                    resource: 'catalogue',
                    name: catalogueCreated.name
                });
            });
        }
    }

    function CatalogueDetailController($state, Catalogue) {
        /* jshint validthis: true */
        var vm = this;

        vm.catalogueId = $state.params.catalogueId;

        if (vm.catalogueId) {
            Catalogue.detail(vm.catalogueId).then(function (catalogueRetrieved) {
                vm.item = catalogueRetrieved;
                vm.item.loaded = true;
            });
        }
    }

    function CatalogueUpdateController($state, $rootScope, EVENTS, Catalogue) {
        /* jshint validthis: true */
        var vm = this;

        vm.update = update;
        vm.updateStatus = updateStatus;

        Catalogue.detail($state.params.catalogueId).then(function (catalogueRetrieved) {
            vm.data = angular.copy(catalogueRetrieved);
            vm.item = catalogueRetrieved;
            vm.item.loaded = true;
        }, function (status) {
            switch (status) {
            case 404:
                $state.go('stock.catalogue', {
                    reload: true
                });
                break;
            }
        });

        function updateStatus(status) {
            vm.data.lifecycleStatus = status;
            vm.statusUpdated = true;
        }

        function update() {
            Catalogue.update(vm.data).then(function (catalogueUpdated) {
                $state.go('stock.catalogue.update', {
                    catalogueId: catalogueUpdated.id
                }, {
                    reload: true
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                    resource: 'catalogue',
                    name: catalogueUpdated.name
                });
            });
        }
    }

})();
