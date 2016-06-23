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

    function ProductDetailController(
        $rootScope, $scope, $state, InventoryProduct, Utils, ProductSpec, EVENTS, $interval, $window, LOGGED_USER, USAGE_CHART_URL) {
        /* jshint validthis: true */
        var vm = this;
        var load = false;
        var digital = false;
        var location;

        vm.item = {};
        vm.$state = $state;
        vm.formatCharacteristicValue = formatCharacteristicValue;
        vm.characteristicValueSelected = characteristicValueSelected;
        vm.isRenewable = isRenewable;
        vm.isUsage = isUsage;
        vm.renewProduct = renewProduct;
        vm.loading = loading;
        vm.isDigital = isDigital;
        vm.downloadAsset = downloadAsset;
        vm.getUsageURL = getUsageURL;

        InventoryProduct.detail($state.params.productId).then(function (productRetrieved) {
            var characteristics = productRetrieved.productOffering.productSpecification.productSpecCharacteristic;
            var hasMedia = false;
            var hasLocation = false;
            var hasAssetType = false;

            vm.item = productRetrieved;
            vm.item.status = LOADED;
            $scope.priceplanSelected = productRetrieved.productPrice[0];

            // Check if the product is digital
            for (var i = 0; i < characteristics.length && (!hasMedia || !hasLocation || !hasAssetType); i++) {
                var charact = characteristics[i];
                if (charact.name.toLowerCase() == 'asset type') {
                    hasAssetType = true;
                }

                if (charact.name.toLowerCase() == 'media type') {
                    hasMedia = true;
                }

                if (charact.name.toLowerCase() == 'location') {
                    hasLocation = true;
                    location = charact.productSpecCharacteristicValue[0].value;
                }
            }

            digital = hasAssetType && hasLocation && hasMedia;
        }, function (response) {
            vm.error = Utils.parseError(response, 'It was impossible to load product details');
            vm.item.status = ERROR;
        });

        function loading() {
            return load;
        }

        function isDigital() {
            return digital;
        }

        function downloadAsset() {
            $window.open(location, '_blank');
        }

        function hasProductPrice() {
            return 'productPrice' in vm.item && vm.item.productPrice.length && 'priceType' in vm.item.productPrice[0];
        }

        function isUsage() {
            return vm.item.productPrice[0].priceType.toLowerCase() == 'usage';
        }

        function isRenewable() {
            return hasProductPrice() && (vm.item.productPrice[0].priceType.toLowerCase() == 'recurring'
                || isUsage());
        }

        function renewProduct() {
            load = true;
            InventoryProduct.renew({
                name: vm.item.name,
                id: vm.item.id,
                priceType: vm.item.productPrice[0].priceType.toLowerCase()
            }).then(function(reviewJob) {
                load = false;
                if ('x-redirect-url' in reviewJob.headers) {
                    var ppalWindow = $window.open(reviewJob.headers['x-redirect-url'], '_blank');
                    var interval;

                    // The function to be called when the payment process has ended
                    var paymentFinished = function(closeModal) {

                        if (interval) {
                            $interval.cancel(interval);
                        }

                        if (closeModal) {
                            $rootScope.$emit(EVENTS.MESSAGE_CLOSED);
                        }

                    };

                    // Display a message and wait until the new tab has been closed to redirect the page
                    $rootScope.$emit(EVENTS.MESSAGE_CREATED, reviewJob.headers['x-redirect-url'], paymentFinished.bind(this, false));

                    if (ppalWindow) {
                        interval = $interval(function () {
                            if (ppalWindow.closed) {
                                paymentFinished(true);
                            }
                        }, 500);
                    }
                }
            }, function (response) {
                load = false;
                var defaultMessage = 'There was an unexpected error that prevented the ' +
                    'system from renewing your product';
                var error = Utils.parseError(response, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            });
        }

        function getUsageURL() {
            var startingChar = USAGE_CHART_URL.indexOf('?') > -1 ? '&' : '?';

            // Get the endpoint of the usage mashup including the access token and the product id
            return USAGE_CHART_URL + startingChar + 'productId=' + vm.item.id + '&token=' + LOGGED_USER.bearerToken;
        }

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
