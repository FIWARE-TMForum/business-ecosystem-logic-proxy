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
        .controller('InventorySearchCtrl', InventorySearchController)
        .controller('InventoryDetailsCtrl', InventoryDetailController);

    function InventorySearchController($state, $rootScope, EVENTS, InventoryProduct, INVENTORY_STATUS, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.state = $state;

        vm.list = [];
        vm.list.flow = $state.params.flow;

        vm.showFilters = showFilters;

        InventoryProduct.search($state.params).then(function (productList) {
            vm.list.status = LOADED;
            angular.copy(productList, vm.list);
        }, function (response) {
            vm.error = Utils.parseError(response, 'It was impossible to load the list of products');
            vm.list.status = ERROR;
        });

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, INVENTORY_STATUS);
        }
    }

    function InventoryDetailController($state, InventoryProduct, Utils) {
        var vm = this;
        vm.product = {};

        InventoryProduct.detail($state.params.productId).then(function(product) {
            vm.status = LOADED;
            angular.copy(product, vm.product);
        }, function(response) {
            vm.error = Utils.parseError(response, 'It was impossible to load product details');
            vm.status = ERROR;
        })
    }
})();
