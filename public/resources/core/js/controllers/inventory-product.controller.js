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
        .controller('InventorySearchCtrl', InventorySearchController);

    function parseError(response, defaultMessage) {
        var data = response['data'];
        return data !== null && 'error' in data ? data['error'] : defaultMessage;
    }

    function InventorySearchController($state, $rootScope, EVENTS, InventoryProduct, INVENTORY_STATUS) {
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
            vm.error = parseError(response, 'It was impossible to load the list of products');
            vm.list.status = ERROR;
        });

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, INVENTORY_STATUS);
        }
    }
})();
