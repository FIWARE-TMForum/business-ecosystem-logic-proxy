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
        .controller('InventoryDetailsCtrl', ProductDetailController);

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

    function ProductDetailController($scope, $state, InventoryProduct, Utils, ProductSpec) {
        /* jshint validthis: true */
        var vm = this;

        vm.item = {};
        vm.$state = $state;
        vm.formatCharacteristicValue = formatCharacteristicValue;
        vm.characteristicValueSelected = characteristicValueSelected;

        InventoryProduct.detail($state.params.productId).then(function (productRetrieved) {
            vm.item = productRetrieved;
            vm.item.status = LOADED;
            $scope.priceplanSelected = productRetrieved.productPrice[0];
        }, function (response) {
            vm.error = Utils.parseError(response, 'It was impossible to load product details');
            vm.item.status = ERROR;
        });

        function characteristicValueSelected(characteristic, characteristicValue) {
            var result, productCharacteristic, i;

            for (i = 0; i < vm.item.productCharacteristic.length; i++) {
                if (vm.item.productCharacteristic[i].name === characteristic.name) {
                    productCharacteristic = vm.item.productCharacteristic[i];
                }
            }

            switch (characteristic.valueType) {
            case ProductSpec.VALUE_TYPES.STRING.toLowerCase():
                result = characteristicValue.value;
                break;
            case ProductSpec.VALUE_TYPES.NUMBER.toLowerCase():
                if (characteristicValue.value && characteristicValue.value.length) {
                    result = characteristicValue.value;
                } else {
                    result = characteristicValue.valueFrom + "-" + characteristicValue.valueTo;
                }
                break;
            }

            return result === productCharacteristic.value;
        }

        function formatCharacteristicValue(characteristic, characteristicValue) {
            var result;

            switch (characteristic.valueType) {
            case ProductSpec.VALUE_TYPES.STRING.toLowerCase():
                result = characteristicValue.value;
                break;
            case ProductSpec.VALUE_TYPES.NUMBER.toLowerCase():
                if (characteristicValue.value && characteristicValue.value.length) {
                    result = characteristicValue.value;
                } else {
                    result = characteristicValue.valueFrom + " - " + characteristicValue.valueTo;
                }
                result += " " + characteristicValue.unitOfMeasure;
                break;
            }

            return result;
        }
    }

})();
