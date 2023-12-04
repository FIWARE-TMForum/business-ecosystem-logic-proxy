/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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
(function() {
    'use strict';

    var LOADING = 'LOADING';
    var LOADED = 'LOADED';
    var ERROR = 'ERROR';

    angular
        .module('app')
        .controller('InventorySearchCtrl', [
            '$scope',
            '$state',
            '$rootScope',
            'EVENTS',
            'InventoryProduct',
            'INVENTORY_STATUS',
            'Utils',
            InventorySearchController
        ])
        .controller('InventoryDetailsCtrl', [
            '$rootScope',
            '$scope',
            '$state',
            'InventoryProduct',
            'Utils',
            'ProductSpec',
            'EVENTS',
            '$interval',
            '$window',
            'LOGGED_USER',
            'USAGE_CHART_URL',
            'BillingAccount',
            'Download',
            'ResourceInventory',
            'ServiceInventory',
            ProductDetailController
        ]);

    function InventorySearchController($scope, $state, $rootScope, EVENTS, InventoryProduct, INVENTORY_STATUS, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.state = $state;

        vm.list = [];
        vm.list.flow = $state.params.flow;
        vm.offset = -1;
        vm.limit = -1;

        vm.showFilters = showFilters;
        vm.getElementsLength = getElementsLength;
        vm.searchInput = '';

        // Initialize the search input content
        vm.initializeInput = initializeInput;
        function initializeInput() {
            if ($state.params.body !== undefined) vm.searchInput = $state.params.body;
        }

        // Returns the input content
        vm.getSearchInputContent = getSearchInputContent;
        function getSearchInputContent() {
            // Returns the content of the search input
            return vm.searchInput;
        }

        // Handle enter press event
        vm.handleEnterKeyUp = handleEnterKeyUp;
        function handleEnterKeyUp(event) {
            if (event.keyCode == 13) $('#searchbutton').click();
        }

        function inventorySearch() {
            vm.list.loadStatus = LOADING;

            if (vm.offset >= 0) {
                var params = {};
                angular.copy($state.params, params);

                params.offset = vm.offset;
                params.limit = vm.limit;

                InventoryProduct.search(params).then(
                    function(productList) {
                        vm.list.loadStatus = LOADED;
                        angular.copy(productList, vm.list);
                    },
                    function(response) {
                        vm.error = Utils.parseError(response, 'It was impossible to load the list of products');
                        vm.list.loadStatus = ERROR;
                    }
                );
            }
        }

        $scope.$watch(function() {
            return vm.offset;
        }, inventorySearch);

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, INVENTORY_STATUS);
        }

        function getElementsLength() {
            //var params = {};
            //angular.copy($state.params, params);
            //return InventoryProduct.count(params);
            return Promise.resolve(10)
        }
    }

    function ProductDetailController(
        $rootScope, $scope, $state, InventoryProduct, Utils, ProductSpec, EVENTS, $interval,
        $window, LOGGED_USER, USAGE_CHART_URL, BillingAccount, Download, ResourceInventory, ServiceInventory) {

        /* Rating stuff */
        $scope.rating = 0;
        $scope.ratings = {
            current: 0,
            max: 5
        };

        $scope.updateSelectedRating = function (rating) {
            console.log(rating);
            //update rating via API
            /*
            "offerId": "205",
	        "description": "rep description",
	        "consumerId" : "mario",
	        "rate" : 1
            */
           var data = {};
           data.offerId = vm.item.productOffering.id;
           data.description = "";
           data.consumerId = LOGGED_USER.id;
           data.rate = rating;
           InventoryProduct.setRating(data).then(function (ratingUpdated) {
               console.log("Rating update OK")
               //$scope.ratings.current = rating;
               //$scope.rating = rating;
           }, function (response){
                console.log("Rating update FAIL")
                //vm.error = Utils.parseError(response, 'The requested rating could not be retrieved');
                //vm.item.status = ERROR;
                //$scope.ratings.current = 0;
            });
        }

        function getCurrentOwnRating(offeringId){
            InventoryProduct.getOwnRating(offeringId, LOGGED_USER.id).then(function (ratingRetrieved) {
                if(ratingRetrieved)
                    $scope.ratings.current = ratingRetrieved;
                else{
                    $scope.rating = 0;
                    $scope.ratings.current = 0;
                }
            }, function (response){
                //vm.error = Utils.parseError(response, 'The requested rating could not be retrieved');
                //vm.item.status = ERROR;
                $scope.rating = 0;
                $scope.ratings.current = 0;
            })
        }

        /* jshint validthis: true */
        var vm = this;
        var load = false;
        var digital = false;
        var locations = [];
        var hasApplicationId = false;

        vm.item = {};
        vm.offerings = [];
        vm.charges = {
            loadStatus: LOADED,
            items: []
        };

        vm.$state = $state;
        vm.formatCharacteristicValue = formatCharacteristicValue;
        vm.characteristicValueSelected = characteristicValueSelected;
        vm.hasProductPrice = hasProductPrice;
        vm.isRenewable = isRenewable;
        vm.isSuspended = isSuspended;
        vm.isUsage = isUsage;
        vm.renewProduct = renewProduct;
        vm.renewProductModal = renewProductModal;
        vm.removeProduct = removeProduct;
        vm.removeProductModal = removeProductModal;
        vm.loading = loading;
        vm.isDigital = isDigital;
        vm.isProtected = isProtected;
        vm.downloadAsset = downloadAsset;
        vm.getUsageURL = getUsageURL;
        vm.downloadInvoice = downloadInvoice;
        vm.tokenSupported = tokenSupported;
        vm.initUsageChart = initUsageChart;
        vm.password = "";
        vm.refreshToken = "";
        vm.sla = "";

        vm.resources = []
        vm.services = []
    
        function tokenSupported() {
            // To be updated when functionality available in Charging backend
            return false;
        }

        InventoryProduct.detail($state.params.productId).then(
            function(productRetrieved) {
                locations = [];
                load = false;

                vm.item = productRetrieved;
                vm.item.loadStatus = LOADED;
                vm.offerings = [];

                if (productRetrieved.productPrice && productRetrieved.productPrice.length > 0) {
                    $scope.priceplanSelected = productRetrieved.productPrice[0];
                }

            digital = false;
            if (!productRetrieved.productOffering.isBundle) {
                vm.offerings.push(productRetrieved.productOffering);
                checkOfferingProduct(productRetrieved.productOffering);
            } else {
                productRetrieved.productOffering.bundledProductOffering.forEach(function(offering) {
                    vm.offerings.push(offering);
                    checkOfferingProduct(offering);
                });
            }

            getSla(productRetrieved.productOffering.id);
            getCurrentOwnRating(productRetrieved.productOffering.id);
            getResources(productRetrieved);
            getServices(productRetrieved);

            // Retrieve existing charges
            /*BillingAccount.searchCharges(vm.item.id).then(function(charges) {
                // Extract invoice url
                vm.charges.items = charges.map(function(charge) {
                    var invoiceUrl = charge.description.split(' ').pop();
                    charge.description = charge.description.substring(0, charge.description.indexOf(invoiceUrl) - 1);
                    charge.invoice = invoiceUrl;
                    return charge;
                });
                vm.charges.loadStatus = LOADED;

            }, function(response) {
                vm.charges.error = Utils.parseError(response, 'It was impossible to load the list of charges');
                vm.charges.loadStatus = ERROR;
            });*/

            },
            function(response) {
                vm.error = Utils.parseError(response, 'It was impossible to load product details');
                vm.item.loadStatus = ERROR;
            }
        );

        function getResources(product) {
            if (product.realizingResource) {
                Promise.all(product.realizingResource.map((res) => {
                    return ResourceInventory.detail(res.id)
                })).then((resources) => {
                    vm.resources = resources
                })
            }
        }

        function getServices(product) {
            if (product.productCharacteristic) {
                const service_chars = product.productCharacteristic.filter((serv) => {
                    return serv.name.toLowerCase() == 'service'
                })

                Promise.all(service_chars.map((serv) => {
                    return ServiceInventory.detail(serv.value)
                })).then((services) => {
                    vm.services = services
                })
            }
        }

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

        function getSla(offeringId){
            InventoryProduct.getSla(offeringId).then(function (slaRetrieved) {
                vm.sla = slaRetrieved;
            }, function (response){
                vm.error = Utils.parseError(response, 'The requested SLA could not be retrieved');
                vm.item.loadStatus = ERROR;
            })
        }

        function checkDigital(characteristics) {
            var hasMedia = false;
            var hasLocation = false;
            var hasAssetType = false;
            

            // Check if the product is digital
            if (characteristics) {
                for (var i = 0; i < characteristics.length ; i++) { //removed && (!hasMedia || !hasLocation || !hasAssetType)
                    var charact = characteristics[i];
                    if (charact.name.toLowerCase() == 'asset type') {
                        hasAssetType = true;
                    }
                    else
                    if (charact.name.toLowerCase() == 'media type') {
                        hasMedia = true;
                    }
                    else
                    if (charact.name.toLowerCase() == 'location') {
                        hasLocation = true;
                        locations.push(charact.productSpecCharacteristicValue[0].value);
                    }
                    else
                    if (charact.name.toLowerCase() == 'appid') {
                        hasApplicationId = true;
                        applicationId = charact.productSpecCharacteristicValue[0].value;
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
                // Check if the file is internal or not
                if (location.startsWith($window.location.origin)) {
                    Download.download(location).then((result) => {
                        let url = $window.URL.createObjectURL(result);
                        $window.open(url, '_blank');
                    });
                } else {
                    $window.open(location, '_blank');
                }
            });
        }

        function hasProductPrice() {
            return 'productPrice' in vm.item && vm.item.productPrice.length && 'priceType' in vm.item.productPrice[0];
        }

        function isUsage() {
            return hasProductPrice() && vm.item.productPrice[0].priceType.toLowerCase() == 'usage';
        }

        function isProtected() {
            return hasApplicationId;
        }

        function isRenewable() {
            return hasProductPrice() && (vm.item.productPrice[0].priceType.toLowerCase() == 'recurring' || isUsage());
        }

        function isSuspended() {
            return vm.item.status.toLowerCase() == 'suspended' || vm.item.status.toLowerCase() == 'terminated';
        }

        function processPayment(reviewJob) {
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
                // Reload inventory page
                $state.go($state.current, {}, {reload: true});

            };

            // Display a message and wait until the new tab has been closed to redirect the page
            $rootScope.$emit(EVENTS.MESSAGE_CREATED, reviewJob.headers['x-redirect-url'], paymentFinished.bind(this, false));

            if (ppalWindow) {
                interval = $interval(function() {
                    if (ppalWindow.closed) {
                        paymentFinished(true);
                    }
                }, 500);
            }
        }

        function removeProductModal() {
            $('#confirm-prod-modal').modal('show');
        }

        function removeProduct() {
            $('#confirm-prod-modal').modal('hide');
            $('.modal-backdrop').remove();
            load = true;
            InventoryProduct.remove({
                name: vm.item.name,
                id: vm.item.id,
                priceType: vm.item.productPrice[0].priceType.toLowerCase()
            }).then(
                function(reviewJob) {
                    if ('x-redirect-url' in reviewJob.headers) {
                        processPayment(reviewJob);
                    } else {
                        // Reload inventory page
                        $state.go($state.current, {}, {reload: true});
                    }
                },
                function(response) {
                    load = false;
                    var defaultMessage =
                        'There was an unexpected error that prevented the ' + 'system from unsubscribing your product';
                    var error = Utils.parseError(response, defaultMessage);

                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: error
                    });
                }
            );
        }

        function renewProductModal() {
            $('#confirm-renew').modal('show');
        }

        function renewProduct() {
            $('#confirm-renew').modal('hide');
            $('.modal-backdrop').remove();
            load = true;
            InventoryProduct.renew({
                name: vm.item.name,
                id: vm.item.id,
                priceType: vm.item.productPrice[0].priceType.toLowerCase()
            }).then(
                function(reviewJob) {
                    load = false;
                    if ('x-redirect-url' in reviewJob.headers) {
                        processPayment(reviewJob);
                    } else {
                        // Reload inventory page
                        $state.go($state.current, {}, {reload: true});
                    }
                },
                function(response) {
                    load = false;
                    var defaultMessage =
                        'There was an unexpected error that prevented the ' + 'system from renewing your product';
                    var error = Utils.parseError(response, defaultMessage);

                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: error
                    });
                }
            );
        }

        function initUsageChart() {
            // Initialize the echarts instance based on the prepared dom
            var myChart = echarts.init(document.getElementById('usage-chart'));

            // Specify the configuration items and data for the chart
            const now = moment(vm.item.startDate)
            const data = [now.format('DD-MM-YYYY')]

            for (let i = 0; i < 7; i++) {
                now.add(1, 'day')
                data.push(now.format('DD-MM-YYYY'))
            }

            var option = {
                xAxis: {
                    type: 'category',
                    data: data
                },
                yAxis: {
                    type: 'value'
                },
                series: [
                    {
                      data: [0],
                      type: 'line'
                    }
                ]
            };

            // Display the chart using the configuration items and data just specified.
            myChart.setOption(option);
        }

        function getUsageURL() {
            var startingChar = USAGE_CHART_URL.indexOf('?') > -1 ? '&' : '?';
            var server = window.location.origin;
            var orderId = vm.item.name.split('=')[1];

            // Get the endpoint of the usage mashup including the access token and the product id
            return (
                USAGE_CHART_URL +
                startingChar +
                'orderId=' +
                orderId +
                '&productId=' +
                vm.item.id +
                '&token=' +
                LOGGED_USER.bearerToken +
                '&server=' +
                server
            );
        }

        function characteristicMatches(productChar, specChar, offId, productId) {
            var name = '';
            var prodCharId = productId ? 'product:' + productId : null;
            var offCharId = offId ? 'offering:' + offId : null;

            if (vm.offerings.length > 1 && productId) {
                var parsedName = productChar.name.split(' ');

                if (parsedName.length > 2 && parsedName[0] === offCharId && parsedName[1] === prodCharId) {
                    name = parsedName.slice(2).join(' ');
                }
            } else if (vm.offerings.length <= 1 && productId) {
                var parsedName = productChar.name.split(' ');

                if (parsedName.length > 1 && parsedName[0] === prodCharId) {
                    name = parsedName.slice(1).join(' ');
                }
            } else if (vm.offerings.length > 1 && !productId) {
                var parsedName = productChar.name.split(' ');

                if (parsedName.length > 1 && parsedName[0] === offCharId) {
                    name = parsedName.slice(1).join(' ');
                }
            } else {
                name = productChar.name;
            }

            return name.toLowerCase() === specChar.name.toLowerCase();
        }

        function characteristicValueSelected(characteristic, characteristicValue, offId, productId) {
            var result = formatCharacteristicValue(characteristic, characteristicValue);

            var productCharacteristic = vm.item.productCharacteristic.filter((prodCharacteristic) => {
                return characteristicMatches(prodCharacteristic, characteristic, offId, productId);
            })[0];

            return result === productCharacteristic.value;
        }

        function downloadInvoice(invoice) {
            Download.download(invoice).then((result) => {
                let url = $window.URL.createObjectURL(result);
                $window.open(url, '_blank');
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
                        result = characteristicValue.valueFrom + ' - ' + characteristicValue.valueTo;
                    }
                    result += ' ' + characteristicValue.unitOfMeasure;
                    break;
            }

            return result;
        }
    }
})();
