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

    function InventorySearchController($scope, $state, $rootScope, EVENTS, InventoryProduct, INVENTORY_STATUS, Utils, Party, User) {
        /* jshint validthis: true */
        var vm = this;

        vm.state = $state;

        vm.list = [];
        vm.list.flow = $state.params.flow;
        vm.offset = -1;
        vm.size = -1;

        vm.showFilters = showFilters;
        vm.getElementsLength = getElementsLength;	

	$scope.$on(Party.EVENTS.USER_SESSION_SWITCHED, function (event, message, obj) {
	    if (Party.isOrganization() || User.loggedUser.currentUser.id === User.loggedUser.id){
		inventorySearch();
	    }
	});

	function inventorySearch() {
	    vm.list.status = LOADING;

            if (vm.offset >= 0) {
                var params = {};
                angular.copy($state.params, params);

                params.offset = vm.offset;
                params.size = vm.size;

                InventoryProduct.search(params).then(function (productList) {
                    vm.list.status = LOADED;
                    angular.copy(productList, vm.list);
                }, function (response) {
                    vm.error = Utils.parseError(response, 'It was impossible to load the list of products');
                    vm.list.status = ERROR;
                });
            }
	};
	

        $scope.$watch(function () {
            return vm.offset;
        }, inventorySearch);

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, INVENTORY_STATUS);
        }

        function getElementsLength() {
            var params = {};
            angular.copy($state.params, params);
            return InventoryProduct.count(params);
        }
    }

    function ProductDetailController(
        $rootScope, $scope, $state, InventoryProduct, Utils, ProductSpec, EVENTS, $interval,
        $window, LOGGED_USER, USAGE_CHART_URL, BillingAccount) {

        /* jshint validthis: true */
        var vm = this;
        var load = false;
        var digital = false;
        var locations = [];

        vm.item = {};
        vm.offerings = [];
        vm.charges = {
            status: LOADING,
            items: []
        };

        vm.$state = $state;
        vm.formatCharacteristicValue = formatCharacteristicValue;
        vm.characteristicValueSelected = characteristicValueSelected;
        vm.hasProductPrice = hasProductPrice;
        vm.isRenewable = isRenewable;
        vm.isUsage = isUsage;
        vm.renewProduct = renewProduct;
        vm.loading = loading;
        vm.isDigital = isDigital;
        vm.downloadAsset = downloadAsset;
        vm.getUsageURL = getUsageURL;
        vm.downloadInvoice = downloadInvoice;

        InventoryProduct.detail($state.params.productId).then(function (productRetrieved) {
            locations = [];
            load = false;

            vm.item = productRetrieved;
            vm.item.status = LOADED;
            vm.offerings = [];

            $scope.priceplanSelected = productRetrieved.productPrice[0];

            digital = false;
            if (!productRetrieved.productOffering.isBundle) {
                vm.offerings.push(productRetrieved.productOffering);
                checkOfferingProduct(productRetrieved.productOffering);
            } else {
                productRetrieved.productOffering.bundledProductOffering.forEach(function(offering) {
                    vm.offerings.push(offering);
                    checkOfferingProduct(offering);
                })
            }

            // Retrieve existing charges
            BillingAccount.searchCharges(vm.item.id).then(function(charges) {
                // Extract invoice url
                vm.charges.items = charges.map(function(charge) {
                    var invoiceUrl = charge.description.split(' ').pop();
                    charge.description = charge.description.substring(0, charge.description.indexOf(invoiceUrl) - 1);
                    charge.invoice = invoiceUrl;
                    return charge;
                });
                vm.charges.status = LOADED;

            }, function(response) {
                vm.charges.error = Utils.parseError(response, 'It was impossible to load the list of charges');
                vm.charges.status = ERROR;
            });

        }, function (response) {
            vm.error = Utils.parseError(response, 'It was impossible to load product details');
            vm.item.status = ERROR;
        });

        function checkOfferingProduct(offering) {
            var characteristics = offering.productSpecification.productSpecCharacteristic;

            // Check if the product is a bundle of products
            if (!offering.productSpecification.isBundle) {
                digital = checkDigital(characteristics) || digital;
            } else {

                if (!offering.productSpecification.bundledProductSpecification[0].productSpecCharacteristic) {

                    ProductSpec.extendBundledProducts(offering.productSpecification).then(function() {
                        offering.productSpecification.bundledProductSpecification.forEach(function(product) {
                            digital = checkDigital(product.productSpecCharacteristic) || digital;
                        });
                    });

                } else {
                    offering.productSpecification.bundledProductSpecification.forEach(function(product) {
                        digital = checkDigital(product.productSpecCharacteristic) || digital;
                    });
                }
            }
        }

        function checkDigital(characteristics) {
            var hasMedia = false;
            var hasLocation = false;
            var hasAssetType = false;

            // Check if the product is digital
            if (characteristics) {
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
                        locations.push(charact.productSpecCharacteristicValue[0].value);
                    }
                }
            }

            return hasAssetType && hasLocation && hasMedia;
        }

        function loading() {
            return load;
        }

        function isDigital() {
            return digital;
        }

        function downloadAsset() {
            locations.forEach(function(location) {
                $window.open(location, '_blank');
            });
        }

        function hasProductPrice() {
            return 'productPrice' in vm.item && vm.item.productPrice.length && 'priceType' in vm.item.productPrice[0];
        }

        function isUsage() {
            return hasProductPrice() && vm.item.productPrice[0].priceType.toLowerCase() == 'usage';
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

        function characteristicMatches(productChar, specChar, offId, productId) {
            var name;

            if (vm.offerings.length > 1 && productId) {
                var parsedName = productChar.name.split(' ');

                if (parsedName.length > 2 && parsedName[0] === offId && parsedName[1] === productId) {
                    name = parsedName.slice(2).join(' ');
                }

            } else if (vm.offerings.length <= 1 && productId){
                var parsedName = productChar.name.split(' ');

                if (parsedName.length > 1 && parsedName[0] === productId) {
                    name = parsedName.slice(1).join(' ');
                }
            } else if (vm.offerings.length > 1 && !productId) {
                var parsedName = productChar.name.split(' ');

                if (parsedName.length > 1 && parsedName[0] === offId) {
                    name = parsedName.slice(1).join(' ');
                }
            } else {
                name = productChar.name;
            }

            return name === specChar.name;
        }

        function characteristicValueSelected(characteristic, characteristicValue, offId, productId) {
            var result, productCharacteristic, i;

            for (i = 0; i < vm.item.productCharacteristic.length; i++) {
                if (characteristicMatches(vm.item.productCharacteristic[i], characteristic, offId, productId)) {
                    productCharacteristic = vm.item.productCharacteristic[i];
                }
            }

            result = formatCharacteristicValue(characteristic, characteristicValue);

            return result === productCharacteristic.value;
        }

        function downloadInvoice(invoice) {
            $window.open(invoice, '_blank');
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
