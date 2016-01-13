/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {
    'use strict';

    angular
        .module('app')
        .controller('AcquireOptionsCtrl', AcquireOptionsController);

    function AcquireOptionsController($scope, $rootScope, $element, EVENTS, Product) {
        var vm = this;
        var options = {};
        var nonConf;

        vm.order = function() {
            // Read selected options
            var offeringInfo = {
                id: vm.offering.id,
                href: vm.offering.href,
                name: vm.offering.name,
                options: options
            };
            $rootScope.$broadcast(EVENTS.OFFERING_CONFIGURED, offeringInfo);
        };

        vm.setPricing = function(pricing) {
            options.pricing = pricing;
        };

        vm.getPricing = function() {
            return options.pricing;
        };

        var getIndexOfChar = function getIndexOfChar(char) {
            var index = -1;
            for (var i = 0; i < options.characteristics.length && index == -1; i++) {
                if (options.characteristics[i].characteristic === char) {
                    index = i;
                }
            }
            return index;
        };

        vm.setCharacteristicValue = function(char, value) {
            if (!options.characteristics) {
                options.characteristics = [];
            }

            var index = getIndexOfChar(char);
            if (index > -1) {
                options.characteristics.splice(index, 1)
            }

            options.characteristics.push({
                characteristic: char,
                value: value
            });
        };

        vm.getCharacteristicValue = function(char) {
            return options.characteristics[getIndexOfChar(char)].value;
        };

        vm.isInvalid = function() {
            return ((vm.pricingModels.length && !options.pricing) || (vm.confChars.length && (!options.characteristics || options.characteristics.length != vm.confChars.length + nonConf)));
        };

        $scope.$on(EVENTS.OFFERING_ORDERED, function(event, off) {
            vm.offering = off;
            vm.tab = 1;
            vm.confChars = [];
            vm.pricingModels = [];
            options = {};
            nonConf = 0;

            Product.detail(vm.offering.productSpecification.id).then(function(productInfo) {
                // Check if there are configurable characteristics in the product
                if (productInfo.productSpecCharacteristic) {
                    for(var i = 0; i < productInfo.productSpecCharacteristic.length; i++) {
                        var characteristic = productInfo.productSpecCharacteristic[i];
                        if (characteristic.configurable) {
                            vm.confChars.push(characteristic);
                        } else {
                            vm.setCharacteristicValue(characteristic, characteristic.productSpecCharacteristicValue[0]);
                        }
                    }
                }
                nonConf = options.characteristics.length;

                if (vm.offering.productOfferingPrice && vm.offering.productOfferingPrice.length > 1) {
                    vm.pricingModels = vm.offering.productOfferingPrice;
                } else if (vm.offering.productOfferingPrice && vm.offering.productOfferingPrice.length == 1) {
                    options.pricing = vm.offering.productOfferingPrice[0];
                }

                // In there is something that require configuration show the modal
                if (vm.confChars.length || vm.pricingModels.length) {
                    $element.modal('show');
                } else {
                    vm.order();
                }
            });
        });
    }
})();
