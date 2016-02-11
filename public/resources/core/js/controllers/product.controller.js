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
        .controller('ProductSearchCtrl', ProductSearchController)
        .controller('ProductCreateCtrl', ProductCreateController)
        .controller('ProductUpdateCtrl', ProductUpdateController);

    function ProductSearchController($state, $rootScope, EVENTS, ProductSpec, LIFECYCLE_STATUS, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.state = $state;

        vm.list = [];
        vm.list.flow = $state.params.flow;

        vm.showFilters = showFilters;

        ProductSpec.search($state.params).then(function (productList) {
            angular.copy(productList, vm.list);
            vm.list.status = LOADED;
        }, function (response) {
            vm.error = Utils.parseError(response, 'It was impossible to load the list of products');
            vm.list.status = ERROR;
        });

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, LIFECYCLE_STATUS);
        }
    }

    function ProductCreateController($state, $rootScope, EVENTS, ProductSpec, Asset, AssetType, Utils) {
        /* jshint validthis: true */
        var vm = this;
        var stepList = [
            {
                title: 'General',
                templateUrl: 'stock/product/create/general'
            },
            {
                title: 'Bundle',
                templateUrl: 'stock/product/create/bundle'
            },
            {
                title: 'Assets',
                templateUrl: 'stock/product/create/assets'
            },
            {
                title: 'Characteristics',
                templateUrl: 'stock/product/create/characteristics'
            },
            {
                title: 'Attachments',
                templateUrl: 'stock/product/create/attachments'
            },
            {
                title: 'Finish',
                templateUrl: 'stock/product/create/finish'
            }
        ];

        vm.data = ProductSpec.buildInitialData();
        vm.stepList = stepList;
        vm.assetTypes = [];
        vm.charList = [];
        vm.isDigital = false;
        vm.digitalChars = [];

        vm.create = create;
        vm.setCurrentType = setCurrentType;

        vm.toggleBundle = toggleBundle;

        vm.hasProduct = hasProduct;
        vm.toggleProduct = toggleProduct;

        vm.isSelected = isSelected;

        /* CHARACTERISTICS MEMBERS */

        var characteristic = ProductSpec.createCharacteristic();
        var characteristicValue = ProductSpec.createCharacteristicValue();

        vm.VALUE_TYPES = ProductSpec.VALUE_TYPES;

        vm.characteristic = angular.copy(characteristic);
        vm.characteristicValue = angular.copy(characteristicValue);
        vm.characteristics = [];

        vm.createCharacteristic = createCharacteristic;
        vm.removeCharacteristic = removeCharacteristic;
        vm.createCharacteristicValue = createCharacteristicValue;
        vm.removeCharacteristicValue = removeCharacteristicValue;

        vm.setDefaultValue = setDefaultValue;
        vm.getDefaultValueOf = getDefaultValueOf;

        vm.resetCharacteristicValue = resetCharacteristicValue;
        vm.getFormattedValueOf = getFormattedValueOf;

        /* CHARACTERISTICS METHODS */

        function createCharacteristic() {
            vm.characteristics.push(vm.characteristic);
            vm.characteristic = angular.copy(characteristic);
            vm.characteristicValue = angular.copy(characteristicValue);

            return true;
        }

        function removeCharacteristic(index) {
            vm.characteristics.splice(index, 1);
        }

        function createCharacteristicValue() {
            vm.characteristicValue.default = getDefaultValueOf(vm.characteristic) == null;
            vm.characteristic.productSpecCharacteristicValue.push(vm.characteristicValue);
            vm.characteristicValue = angular.copy(characteristicValue);

            if (vm.characteristic.productSpecCharacteristicValue.length > 1) {
                vm.characteristic.configurable = true;
            }

            return true;
        }

        function removeCharacteristicValue(index) {
            var value = vm.characteristic.productSpecCharacteristicValue[index];
            vm.characteristic.productSpecCharacteristicValue.splice(index, 1);

            if (value.default && vm.characteristic.productSpecCharacteristicValue.length) {
                vm.characteristic.productSpecCharacteristicValue[0].default = true;
            }

            if (vm.characteristic.productSpecCharacteristicValue.length <= 1) {
                vm.characteristic.configurable = false;
            }
        }

        function getDefaultValueOf(characteristic) {
            var i, defaultValue;

            for (i = 0; i < characteristic.productSpecCharacteristicValue.length; i++) {
                if (characteristic.productSpecCharacteristicValue[i].default) {
                    defaultValue = characteristic.productSpecCharacteristicValue[i];
                }
            }

            return defaultValue;
        }

        function getFormattedValueOf(characteristic, characteristicValue) {
            var result;

            switch (characteristic.valueType) {
            case ProductSpec.VALUE_TYPES.STRING:
                result = characteristicValue.value;
                break;
            case ProductSpec.VALUE_TYPES.NUMBER:
                result = characteristicValue.value + " " + characteristicValue.unitOfMeasure;
                break;
            case ProductSpec.VALUE_TYPES.NUMBER_RANGE:
                result = characteristicValue.valueFrom + " - " + characteristicValue.valueFrom + " " + characteristicValue.unitOfMeasure;
            }

            return result;
        }

        function resetCharacteristicValue() {
            vm.characteristicValue = angular.copy(characteristicValue);
            vm.characteristic.productSpecCharacteristicValue.length = 0;
        }

        function setDefaultValue(index) {
            var value = getDefaultValueOf(vm.characteristic);

            if (value != null) {
                value.default = false;
            }

            vm.characteristic.productSpecCharacteristicValue[index].default = true;
        }

        AssetType.search().then(function (typeList) {
            angular.copy(typeList, vm.assetTypes);

            if (typeList.length) {
                // Initialize digital asset characteristics
                vm.digitalChars.push(ProductSpec.createCharacteristic({
                    name: "Asset type",
                    description: "Type of the digital asset described in this product specification"
                }));
                vm.digitalChars.push(ProductSpec.createCharacteristic({
                    name: "Media type",
                    description: "Media type of the digital asset described in this product specification"
                }));
                vm.digitalChars.push(ProductSpec.createCharacteristic({
                    name: "Location",
                    description: "URL pointing to the digital asset described in this product specification"
                }));
                vm.currentType = typeList[0];
                vm.currFormat = vm.currentType.formats[0];
                vm.digitalChars[0].productSpecCharacteristicValue[0].value = typeList[0].name;
            }
        });

        function isSelected(format) {
            return vm.currFormat === format;
        }

        function toggleProduct(product) {
            var index = vm.data.bundledProductSpecification.indexOf(product);

            if (index !== -1) {
                vm.data.bundledProductSpecification.splice(index, 1);
            } else {
                vm.data.bundledProductSpecification.push(product);
            }
        }

        function toggleBundle() {
            if (!vm.data.isBundle) {
                vm.data.bundledProductSpecification.length = 0;
            }
        }

        function hasProduct(product) {
            return vm.data.bundledProductSpecification.indexOf(product) !== -1;
        }

        function create() {
            // If the format is file upload it to the asset manager
            if (vm.isDigital && vm.currFormat === 'FILE') {
                var reader = new FileReader();

                reader.onload = function(e) {
                    var data = {
                        content: {
                            name: vm.assetFile.name,
                            data: btoa(e.target.result)
                        },
                        contentType: vm.digitalChars[1].productSpecCharacteristicValue[0].value
                    };
                    Asset.create(data).then(function (result) {
                        // Set file location
                        vm.digitalChars[2].productSpecCharacteristicValue[0].value = result.content;
                        saveProduct();
                    });
                };
                reader.readAsBinaryString(vm.assetFile);
            } else {
                saveProduct();
            }
        }

        function setCurrentType() {
            var i, found = false;
            var assetType = vm.digitalChars[0].productSpecCharacteristicValue[0].value;

            for (i = 0; i < vm.assetTypes.length && !found; i++) {

                if (assetType === vm.assetTypes[i].name) {
                    found = true;
                    vm.currentType = vm.assetTypes[i];
                }
            }
            vm.currFormat = vm.currentType.formats[0];
        }

        function saveProduct() {
            // Append product characteristics
            vm.data.productSpecCharacteristic = vm.characteristics;

            if (vm.isDigital) {
                vm.data.productSpecCharacteristic = vm.data.productSpecCharacteristic.concat(vm.digitalChars);
            }

            ProductSpec.create(vm.data).then(function (productCreated) {
                $state.go('stock.product.update', {
                    productId: productCreated.id
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                    resource: 'product',
                    name: productCreated.name
                });
            }, function (response) {

                var defaultMessage = 'There was an unexpected error that prevented the ' +
                    'system from creating a new product';
                var error = Utils.parseError(response, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            });
        }
    }

    function ProductUpdateController($state, $rootScope, EVENTS, ProductSpec, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.$state = $state;
        vm.item = {};

        vm.update = update;
        vm.updateStatus = updateStatus;
        vm.formatCharacteristicValue = formatCharacteristicValue;

        ProductSpec.detail($state.params.productId).then(function (productRetrieved) {
            vm.data = angular.copy(productRetrieved);
            vm.item = productRetrieved;
            vm.item.status = LOADED;
        }, function (response) {
            vm.error = Utils.parseError(response, 'The requested product could not be retrieved');
            vm.item.status = ERROR;
        });

        function updateStatus(status) {
            vm.data.lifecycleStatus = status;
            vm.statusUpdated = true;
        }

        function update() {
            ProductSpec.update(vm.data).then(function (productUpdated) {
                $state.go('stock.product.update', {
                    productId: productUpdated.id
                }, {
                    reload: true
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                    resource: 'product',
                    name: productUpdated.name
                });
            }, function (response) {

                var defaultMessage = 'There was an unexpected error that prevented the ' +
                    'system from updating the given product';
                var error = Utils.parseError(response, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
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
                    result = characteristicValue.valueFrom + " - " + characteristicValue.valueFrom;
                }

                result += " " + characteristicValue.unitOfMeasure;

                break;
            }

            return result;
        }
    }

})();
