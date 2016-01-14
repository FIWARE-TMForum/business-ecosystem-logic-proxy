/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .controller('ProductSearchCtrl', ProductSearchController)
        .controller('ProductCreateCtrl', ProductCreateController)
        .controller('ProductUpdateCtrl', ProductUpdateController);

    function ProductSearchController($state, $rootScope, EVENTS, Product) {
        /* jshint validthis: true */
        var vm = this;

        vm.state = $state;

        vm.list = [];
        vm.list.flow = $state.params.flow;

        vm.showFilters = showFilters;

        Product.search($state.params).then(function (productList) {
            angular.copy(productList, vm.list);
            vm.list.status = 'LOADED';
        }, function (reason) {
            vm.error = reason;
            vm.list.status = 'ERROR';
        });

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED);
        }
    }

    function ProductCreateController($state, $rootScope, EVENTS, Product, Asset, AssetType) {
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

        vm.data = Product.buildInitialData();
        vm.stepList = stepList;
        vm.assetTypes = [];
        vm.charList = [];

        vm.create = create;
        vm.setCurrentType = setCurrentType;

        vm.toggleBundle = toggleBundle;

        vm.hasProduct = hasProduct;
        vm.toggleProduct = toggleProduct;

        vm.isSelected = isSelected;
        vm.saveCharacteristic = saveCharacteristic;
        vm.removeCharacteristic = removeCharacteristic;

        initChars();

        AssetType.search().then(function (typeList) {
            angular.copy(typeList, vm.assetTypes);

            if (typeList.length) {
                addCharacteristic('Asset type', 'Type of the digital asset described in this product specification', '');
                addCharacteristic('Media type', 'Media type of the digital asset described in this product specification', '');
                addCharacteristic('Location', 'URL pointing to the digital asset described in this product specification', '');
                vm.currentType = typeList[0];
                vm.currFormat = vm.currentType.formats[0];
                vm.data.productSpecCharacteristic[0].productSpecCharacteristicValue[0].value = typeList[0].name;
            }
        });

        function removeCharacteristic(characteristic) {
            var index = vm.charList.indexOf(characteristic);

            if (index > -1) {
                vm.charList.splice(index, 1);
            }
        }

        function saveCharacteristic() {
            var newChar = vm.currentChar;

            // Clean fields that can contain invalid values due to hidden models
            if (newChar.valueType === 'string') {
                vm.currentValue.unitOfMeasure = '';
                vm.currentValue.valueFrom = '';
                vm.currentValue.valueTo = '';
            } else if (vm.currentValueType === 'value'){
                vm.currentValue.valueFrom = '';
                vm.currentValue.valueTo = '';
            } else {
                vm.currentValue.value = '';
            }

            newChar.productSpecCharacteristicValue = [vm.currentValue];
            vm.charList.push(newChar);
            initChars();
        }

        function initChars() {
            vm.currentChar = {
                valueType: 'string',
                configurable: false
            };
            vm.currentValueType = 'value';
            vm.currentValue = {
                default: true
            };
        }

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
            if (vm.currFormat === 'FILE') {
                var reader = new FileReader();

                reader.onload = function(e) {
                    var data = {
                        content: {
                            name: vm.assetFile.name,
                            data: btoa(e.target.result)
                        },
                        contentType: vm.data.productSpecCharacteristic[1].productSpecCharacteristicValue[0].value
                    };
                    Asset.create(data).then(function (result) {
                        // Set file location
                        vm.data.productSpecCharacteristic[2].productSpecCharacteristicValue[0].value = result.content;
                        saveProduct();
                    });
                };
                reader.readAsBinaryString(vm.assetFile);
            } else {
                saveProduct();
            }
        }

        function addCharacteristic(name, description, value) {
            vm.data.productSpecCharacteristic.push({
                name: name,
                description: description,
                valueType: 'string',
                configurable: false,
                validFor: {
                    startDateTime: "",
                    endDateTime: ""
                },
                productSpecCharacteristicValue: [
                    {
                        valueType: 'string',
                        default: true,
                        value: value,
                        unitOfMeasure: "",
                        valueFrom: "",
                        valueTo: "",
                        validFor: {
                            startDateTime: "",
                            endDateTime: ""
                        }
                    }
                ]
            });
        }

        function setCurrentType() {
            var i, found = false;
            var assetType = vm.data.productSpecCharacteristic[0].productSpecCharacteristicValue[0].value;

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
            vm.data.productSpecCharacteristic = vm.data.productSpecCharacteristic.concat(vm.charList);
            Product.create(vm.data).then(function (productCreated) {
                $state.go('stock.product.update', {
                    productId: productCreated.id
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                    resource: 'product',
                    name: productCreated.name
                });
            }, function (reason) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: reason
                });
            });
        }
    }

    function ProductUpdateController($state, $rootScope, EVENTS, Product) {
        /* jshint validthis: true */
        var vm = this;

        vm.update = update;
        vm.updateStatus = updateStatus;

        Product.detail($state.params.productId).then(function (productRetrieved) {
            vm.data = angular.copy(productRetrieved);
            vm.item = productRetrieved;
            vm.item.loaded = true;
        }, function (status) {
            switch (status) {
            case 404:
                $state.go('stock.product', {
                    reload: true
                });
                break;
            }
        });

        function updateStatus(status) {
            vm.data.lifecycleStatus = status;
            vm.statusUpdated = true;
        }

        function update() {
            Product.update(vm.data).then(function (productUpdated) {
                $state.go('stock.product.update', {
                    productId: productUpdated.id
                }, {
                    reload: true
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                    resource: 'product',
                    name: productUpdated.name
                });
            }, function(reason) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: reason
                });
            });
        }
    }

})();
