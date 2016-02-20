/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .controller('AcquireOptionsCtrl', AcquireOptionsController);

    function AcquireOptionsController($scope, $rootScope, $element, EVENTS, ProductSpec) {
        /* jshint validthis: true */
        var vm = this;

        var data = {};
        var characteristics = [];
        var priceplan = null;

        vm.characteristicsTab = {
            title: "Characteristics"
        };
        vm.priceplansTab = {
            title: "Price plans"
        };

        vm.tabs = [];
        vm.tabActive = null;

        vm.configurableCharacteristics = [];
        vm.priceplans = [];

        vm.order = order;
        vm.isValid = isValid;
        vm.getCharacteristicValue = getCharacteristicValue;
        vm.setCharacteristicValue = setCharacteristicValue;
        vm.formatCharacteristicValue = formatCharacteristicValue;
        vm.getPriceplan = getPriceplan;
        vm.setPriceplan = setPriceplan;

        $scope.$on(EVENTS.OFFERING_ORDERED, function (event, productOffering) {
            data = {
                id: productOffering.id,
                href: productOffering.href,
                name: productOffering.name,
                options: {}
            };

            characteristics = [];
            priceplan = null;

            vm.tabs = [];
            vm.tabActive = null;
            vm.configurableCharacteristics = [];
            vm.priceplans = [];

            loadCharacteristics(productOffering.productSpecification.productSpecCharacteristic);
            loadPriceplans(productOffering.productOfferingPrice);

            if (vm.configurableCharacteristics.length || vm.priceplans.length) {
                $element.modal('show');
            } else {
                order();
            }
        });

        function order() {
            data.options = {
                characteristics: characteristics,
                pricing: priceplan
            };
            $rootScope.$broadcast(EVENTS.OFFERING_CONFIGURED, data);
        }

        function isValid() {
            return !vm.priceplans.length || priceplan != null;
        }

        function getCharacteristicValue(characteristic) {
            return characteristics[indexOfCharacteristic(characteristic)].value;
        }

        function setCharacteristicValue(characteristic, characteristicValue) {
            var index = indexOfCharacteristic(characteristic);

            if (index !== -1) {
                characteristics.splice(index, 1);
            }

            characteristics.push({
                characteristic: characteristic,
                value: characteristicValue
            });
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

        function getPriceplan() {
            return priceplan;
        }

        function setPriceplan(productOfferingPrice) {
            priceplan = productOfferingPrice;
            $scope.priceplanSelected = productOfferingPrice;
        }

        function loadCharacteristics(productSpecCharacteristic) {

            if (angular.isArray(productSpecCharacteristic) && productSpecCharacteristic.length) {
                productSpecCharacteristic.forEach(function (characteristic) {
                    if (characteristic.configurable) {
                        vm.configurableCharacteristics.push(characteristic);
                    }
                    vm.setCharacteristicValue(characteristic, getDefaultCharacteristicValue(characteristic));
                });
            }

            if (vm.configurableCharacteristics.length) {
                vm.tabs.push(vm.characteristicsTab);
                vm.tabActive = vm.characteristicsTab;
            }
        }

        function loadPriceplans(productOfferingPrice) {

            if (angular.isArray(productOfferingPrice) && productOfferingPrice.length) {
                if (productOfferingPrice.length === 1) {
                    priceplan = productOfferingPrice[0];
                }
                vm.priceplans = productOfferingPrice;
            }

            if (vm.priceplans.length) {
                vm.tabs.push(vm.priceplansTab);
                if (vm.tabActive == null) {
                    vm.tabActive = vm.priceplansTab;
                }
            }
        }

        function indexOfCharacteristic(characteristic) {
            var i, index = -1;

            for (i = 0; i < characteristics.length && index === -1; i++) {
                if (characteristics[i].characteristic === characteristic) {
                    index = i;
                }
            }

            return index;
        }

        function getDefaultCharacteristicValue(characteristic) {
            var i, characteristicValue;

            for (i = 0; i < characteristic.productSpecCharacteristicValue.length; i++) {
                if (characteristic.productSpecCharacteristicValue[i].default) {
                    characteristicValue = characteristic.productSpecCharacteristicValue[i];
                }
            }

            return characteristicValue;
        }
    }

})();
