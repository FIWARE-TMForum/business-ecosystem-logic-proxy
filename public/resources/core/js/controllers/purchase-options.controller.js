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

    angular
        .module('app')
        .controller('AcquireOptionsCtrl', AcquireOptionsController);

    function AcquireOptionsController($scope, $rootScope, $element, EVENTS, ProductSpec) {
        /* jshint validthis: true */
        var vm = this;

        var data = {};
        var priceplan = null;

        vm.characteristicsTab = {
            title: "Characteristics"
        };
        vm.priceplansTab = {
            title: "Price plans"
        };

        vm.tabs = [];
        vm.tabActive = null;

        vm.characteristics = [];
        vm.priceplans = [];

        vm.order = order;
        vm.isValid = isValid;
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

            priceplan = null;

            vm.tabs = [];
            vm.tabActive = null;
            vm.priceplans = [];
            vm.characteristics = [];

            $scope.priceplanSelected = null;

            loadCharacteristics(productOffering.productSpecification.productSpecCharacteristic);
            loadPriceplans(productOffering.productOfferingPrice);

            if (vm.characteristics.length || vm.priceplans.length) {
                $element.modal('show');
            } else {
                order();
            }
        });

        function order() {
            data.options = {
                characteristics: vm.characteristics,
                pricing: priceplan
            };
            $rootScope.$broadcast(EVENTS.OFFERING_CONFIGURED, data);
        }

        function isValid() {
            return !vm.priceplans.length || priceplan != null;
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

            if (!angular.isArray(productSpecCharacteristic)) {
                productSpecCharacteristic = [];
            }

            vm.characteristics = productSpecCharacteristic.map(function (characteristic) {
                return {
                    characteristic: characteristic,
                    value: getDefaultCharacteristicValue(characteristic)
                };
            });

            if (vm.characteristics.length) {
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
