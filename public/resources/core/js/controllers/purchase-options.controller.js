/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the bae-logic-proxy-test of the
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
        .controller('AcquireOptionsCtrl', ['$scope', '$rootScope', '$element', 'EVENTS', 'ProductSpec', AcquireOptionsController]);

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
        vm.legalTab = {
            title: "Terms & Conditions"
        };

        vm.tabs = [];
        vm.tabActive = null;

        vm.characteristics = [];
        vm.priceplans = [];
        vm.terms = [];
        vm.selectedOffering = null;
        vm.termsAccepted = false;

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
            vm.terms = productOffering.productOfferingTerm;
            vm.isBundle = productOffering.isBundle;
            vm.bundledOfferings = [];
            vm.selectedOffering = {
                id: productOffering.id
            };
            vm.termsAccepted = false;

            $scope.priceplanSelected = null;

            if (!productOffering.isBundle) {
                processProductCharacteristics(productOffering.productSpecification, {offId: productOffering.id}, function() {
                    loadTerms();
                    loadPriceplans(productOffering.productOfferingPrice);
                    showModal();
                });
            } else {
                // When the offering is a bundle products are included in its bundled offerings
                var processed = 0;
                vm.bundledOfferings = [];
                vm.selectedOffering = productOffering.bundledProductOffering[0];

                productOffering.bundledProductOffering.forEach(function(offering) {
                    processProductCharacteristics(offering.productSpecification, {
                        offId: offering.id,
                        offName: offering.name
                    }, function() {
                        processed += 1;

                        vm.bundledOfferings.push({
                            name: offering.name,
                            id: offering.id
                        });

                        if (processed === productOffering.bundledProductOffering.length) {
                            loadTerms();
                            loadPriceplans(productOffering.productOfferingPrice);
                            showModal();
                        }
                    });
                });
            }
        });

        function processProductCharacteristics(product, offInfo, callback) {
            loadCharacteristics(product.productSpecCharacteristic, offInfo);

            if (product.isBundle) {
                // Extend bundled product spec to obtain its characteristics
                ProductSpec.extendBundledProducts(product).then(function () {

                    product.bundledProductSpecification.forEach(function (productSpec) {
                        loadCharacteristics(productSpec.productSpecCharacteristic, angular.extend({
                            id: productSpec.id,
                            name: productSpec.name
                        }, offInfo));
                    });

                    callback();
                });
            } else {
                callback();
            }
        }

        function showModal() {
            if (vm.characteristics.length || vm.priceplans.length || vm.terms.length) {
                $element.modal('show');
            } else {
                order();
            }
        }

        function order() {
            data.options = {
                characteristics: vm.characteristics,
                pricing: priceplan
            };
            $rootScope.$broadcast(EVENTS.OFFERING_CONFIGURED, data);
        }

        function isValid() {
            return (!vm.priceplans.length || priceplan != null) && ((vm.terms.length > 0 && vm.termsAccepted) || (!vm.terms.length));
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

        function loadCharacteristics(productSpecCharacteristic, productInfo) {

            if (!angular.isArray(productSpecCharacteristic)) {
                productSpecCharacteristic = [];
            }

            productInfo.characteristics = productSpecCharacteristic.filter(function(characteristic) {
                var isLicense = characteristic.name.toLowerCase() == 'license';
                if (isLicense) {
                    vm.terms.push(angular.extend({
                        title: characteristic.productSpecCharacteristicValue[0].value,
                        text: characteristic.description
                    }, productInfo));
                }
                return !isLicense;

            }).map(function (characteristic) {
                return {
                    characteristic: characteristic,
                    value: getDefaultCharacteristicValue(characteristic)
                };
            });

            if (productInfo.characteristics.length) {
                vm.characteristics.push(productInfo);
            }

            if (vm.characteristics.length && vm.tabs.indexOf(vm.characteristicsTab) === -1) {
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

        function getDefaultCharacteristicValue(characteristic) {
            var i, characteristicValue;

            for (i = 0; i < characteristic.productSpecCharacteristicValue.length; i++) {
                if (characteristic.productSpecCharacteristicValue[i].default) {
                    characteristicValue = characteristic.productSpecCharacteristicValue[i];
                }
            }

            return characteristicValue;
        }

        function loadTerms() {
            if (vm.terms[0].type != 'None' && vm.tabs.indexOf(vm.legalTab) === -1) {
                vm.tabs.push(vm.legalTab);
                if (vm.tabActive == null) {
                    vm.tabActive = vm.legalTab;
                }
            }
        }
    }

})();
