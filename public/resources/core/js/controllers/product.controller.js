/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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
        .controller('ProductSearchCtrl', ['$scope', '$state', '$timeout', '$rootScope', 'EVENTS', 'ProductSpec',
            'LIFECYCLE_STATUS', 'DATA_STATUS', 'Utils', ProductSearchController])

        .controller('ProductCreateCtrl', ['$q', '$scope', '$state', '$rootScope', 'EVENTS', 'PROMISE_STATUS',
            'ProductSpec', 'Asset', 'AssetType', 'Utils', ProductCreateController])

        .controller('ProductImportCtrl', ['$q', '$scope', '$state', '$rootScope', '$http', 'EVENTS', 'PROMISE_STATUS',
            'ProductSpec', 'Asset', 'AssetType', 'Utils', ProductImportController])

        .controller('ProductUpdateCtrl', ['$state', '$scope', '$rootScope', 'EVENTS', 'PROMISE_STATUS', 'ProductSpec',
            'Utils', 'Asset', ProductUpdateController])

        .controller('ProductUpgradeCtrl', ['$state', '$rootScope', '$element', 'AssetType', 'ProductSpec', 'Utils',
            'EVENTS', ProductUpgradeController])

        .controller('AssetController', ['$scope', '$rootScope', 'Asset', 'ProductSpec', 'Utils', 'EVENTS', AssetController]);



    function ProductSearchController($scope, $state, $timeout, $rootScope, EVENTS, ProductSpec, LIFECYCLE_STATUS, DATA_STATUS, Utils) {
        /* jshint validthis: true */
        var vm = this;
        var filters = {};
        var formMode = false;

        vm.state = $state;
        vm.STATUS = DATA_STATUS;

        vm.offset = -1;
        vm.size = -1;
        vm.list = [];

        vm.list = [];
        vm.list.flow = $state.params.flow;

        vm.showFilters = showFilters;
        vm.getElementsLength = getElementsLength;
        vm.setFilters = setFilters;
        vm.launchSearch = launchSearch;
        vm.setFormMode = setFormMode;
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
            if (event.keyCode == 13) {
                var selector = formMode ? '#formSearch' : '#searchbutton';
                $timeout(function() {
                    $(selector).click();
                });
            }
        }

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, LIFECYCLE_STATUS);
        }

        function getParams() {
            var params = {};

            if (!formMode) {
                angular.copy($state.params, params);
            } else {
                if (filters.bundle !== undefined) {
                    params.type = filters.bundle;
                }

                params.status = 'Active,Launched';
                params.owner = true;
                // When the searchProduct controller is used in a form (Product Spec Bundle or Offering Product)
                // the search text is not retrieved from the URL page
                if (vm.searchInput.length) {
                    params.body = vm.searchInput;
                }
            }
            return params;
        }

        function getElementsLength() {
            var params = getParams();
            return ProductSpec.count(params);
        }

        function setFilters(newFilters) {
            filters = newFilters;
        }

        function setFormMode(mode) {
            formMode = mode;
        }

        function launchSearch() {
            vm.offset = -1;
            vm.reloadPager();
        }

        vm.list.status = vm.STATUS.LOADING;

        function productSearch() {
            vm.list.status = vm.STATUS.LOADING;
            if (vm.offset >= 0) {
                var params = getParams();

                params.offset = vm.offset;
                params.size = vm.size;

                ProductSpec.search(params).then(
                    function(productList) {
                        angular.copy(productList, vm.list);
                        vm.list.status = vm.STATUS.LOADED;
                    },
                    function(response) {
                        vm.errorMessage = Utils.parseError(response, 'It was impossible to load the list of products');
                        vm.list.status = vm.STATUS.ERROR;
                    }
                );
            }
        }

        $scope.$watch(function() {
            return vm.offset;
        }, productSearch);
    }

    function buildPictureController(vm, $scope, pictureForm, Asset) {
        vm.clearFileInput = clearFileInput;

        function clearFileInput() {
            if (!pictureForm.pictureFile) {
                pictureForm.pictureFile = {};
            } else {
                // Reset possible previous errors
                pictureForm.pictureFile.$invalid = false;
                pictureForm.pictureFile.$error = {};
            }
        }

        $scope.$watch(
            function watchFile() {
                return vm.pictureFile;
            },
            function() {
                // Check that the new file is a valid image
                if (vm.pictureFile) {
                    vm.clearFileInput();
                    pictureForm.pictureFile.$dirty = true;

                    if (
                        vm.pictureFile.type != 'image/gif' &&
                        vm.pictureFile.type != 'image/jpeg' &&
                        vm.pictureFile.type != 'image/png' &&
                        vm.pictureFile.type != 'image/bmp'
                    ) {
                        // Set input error
                        pictureForm.pictureFile.$invalid = true;
                        pictureForm.pictureFile.$error = {
                            format: true
                        };
                        return;
                    }

                    var scope = vm.data.name.replace(/ /g, '');

                    if (scope.length > 10) {
                        scope = scope.substr(0, 10);
                    }
                    // Upload the file to the server when it is included in the input
                    Asset.uploadAsset(
                        vm.pictureFile,
                        scope,
                        null,
                        vm.pictureFile.type,
                        true,
                        null,
                        function(result) {
                            vm.data.attachment[0].url = result.content;
                        },
                        function() {
                            // The picture cannot be uploaded set error in input
                            pictureForm.pictureFile.$invalid = true;
                            pictureForm.pictureFile.$error = {
                                upload: true
                            };
                        }
                    );
                }
            }
        );
        clearFileInput();
    }

    function buildFileController(vm, $scope, form, Asset) {
        function clearFileInput() {
            if (!form.extraFile) {
                form.extraFile = {};
            } else {
                // Reset possible previous errors
                form.extraFile.$invalid = false;
                form.extraFile.$error = {};
            }
        }

        vm.removeExtraFile = function(index) {
            vm.extraFiles.splice(index, 1);
        };

        $scope.$watch(
            function() {
                return vm.extraFile;
            },
            function() {
                // Check that the new file is a valid image
                if (vm.extraFile) {
                    clearFileInput();
                    form.extraFile.$dirty = true;

                    var prefix = vm.data.name.replace(/ /g, '');

                    if (prefix.length > 10) {
                        prefix = prefix.substr(0, 10);
                    }

                    // Upload the file to the server when it is included in the input
                    Asset.uploadAsset(
                        vm.extraFile,
                        prefix,
                        null,
                        vm.extraFile.type,
                        true,
                        null,
                        function(result) {
                            vm.extraFiles.push({
                                name: vm.extraFile.name,
                                type: vm.extraFile.type,
                                href: result.content
                            });
                        },
                        function() {
                            // The picture cannot be uploaded set error in input
                            form.extraFile.$invalid = true;
                            form.extraFile.$error = {
                                upload: true
                            };
                        }
                    );
                }
            }
        );

        clearFileInput();
    }

    function ProductImportController($q, $scope, $state, $rootScope, $http, EVENTS, PROMISE_STATUS, ProductSpec, Asset, AssetType, Utils){
        var vm =this;
        var createPromise = null;
        var stepList = [
            {
                title: 'Datastore',
                templateUrl: 'stock/product/import/datastore'
            },
            {
                title: 'Finish',
                templateUrl: 'stock/product/import/finish'
            }
        ];

        vm.STATUS = PROMISE_STATUS;
        vm.stepList = stepList;
        vm.assetTypes = [];
        vm.charList = [];
        vm.isDigital = false;
        vm.digitalChars = [];
        vm.terms = {};
        vm.characteristicEnabled = false;
        vm.pictureFormat = "url";

        vm.create = create;
        vm.setCurrentType = setCurrentType;

        vm.toggleBundle = toggleBundle;

        vm.hasProduct = hasProduct;
        vm.toggleProduct = toggleProduct;

        vm.isSelected = isSelected;

        vm.createRelationship = createRelationship;
        vm.removeRelationship = removeRelationship;

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
        vm.clearFileInput = clearFileInput;

        function createRelationship(data) {
            var deferred = $q.defer();

            vm.data.productSpecificationRelationship.push(data);
            deferred.resolve(vm.data);

            return deferred.promise;
        }

        function removeRelationship(index) {
            var deferred = $q.defer();

            vm.data.productSpecificationRelationship.splice(index, 1);
            deferred.resolve(vm.data);

            return deferred.promise;
        }

        /* CHARACTERISTICS METHODS */

        function createCharacteristic() {
            vm.characteristics.push(vm.characteristic);
            vm.characteristic = angular.copy(characteristic);
            vm.characteristicValue = angular.copy(characteristicValue);
            vm.characteristicEnabled = false;
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
                result = characteristicValue.valueFrom + " - " + characteristicValue.valueTo + " " + characteristicValue.unitOfMeasure;
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
                vm.digitalChars[0].productSpecCharacteristicValue.push(ProductSpec.createCharacteristicValue({
                    default: true,
                    value: typeList[0].name
                }));
                vm.digitalChars.push(ProductSpec.createCharacteristic({
                    name: "Media type",
                    description: "Media type of the digital asset described in this product specification"
                }));
                vm.digitalChars[1].productSpecCharacteristicValue.push(ProductSpec.createCharacteristicValue({
                    default: true
                }));
                vm.digitalChars.push(ProductSpec.createCharacteristic({
                    name: "Location",
                    description: "URL pointing to the digital asset described in this product specification"
                }));
                vm.digitalChars[2].productSpecCharacteristicValue.push(ProductSpec.createCharacteristicValue({
                    default: true
                }));
                vm.currentType = typeList[0];
                vm.currFormat = vm.currentType.formats[0];
            }
        });

        function isSelected(format) {
            return vm.currFormat === format;
        }

        function filterProduct(product) {
            var i = -1;
            vm.data.bundledProductSpecification.forEach(function (bundledProduct, index) {
                if (bundledProduct.id == product.id) {
                    i = index;
                }
            });
            return i;
        }

        function toggleProduct(product) {
            var index = filterProduct(product);

            if (index !== -1) {
                vm.data.bundledProductSpecification.splice(index, 1);
            } else {
                vm.data.bundledProductSpecification.push(product);
            }

            stepList[1].form.$valid = vm.data.bundledProductSpecification.length >= 2;
        }

        function toggleBundle() {
            if (!vm.data.isBundle) {
                vm.data.bundledProductSpecification.length = 0;
                stepList[1].form.$valid = true;
            } else {
                stepList[1].form.$valid = false;
            }
        }

        function hasProduct(product) {
            return filterProduct(product) > -1;
        }

        function uploadAsset(file, contentType, publicFile, callback, errCallback) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var data = {
                    content: {
                        name: file.name,
                        data: btoa(e.target.result)
                    },
                    contentType: contentType
                };

                if (publicFile) {
                    data.isPublic = true;
                }

                Asset.create(data).then(callback, errCallback);
            };
            reader.readAsBinaryString(file);
        }

        function create() {
            importCkanPackages();
        }

        function importCkanPackages(){
            var proxyServerUrl = 'http://127.0.0.1:5000/ckan/packages'
            var postData = {'url': vm.datastore.baseUrl}
            $http.post(proxyServerUrl, postData).then(function successCallback(response){
                var testing = true;
                var l = testing?10:response.data.result.length;
                if(vm.datastore.baseUrl.endsWith("/")){
                                vm.datastore.baseUrl = vm.datastore.baseUrl.slice(0, -1);
                            }
                for(var i=0; i<l;i++){
                            registerCkanPackage(response.data.result[i], i+1);
                        }
            });
        }

        function initializeCharacteristic(){
            // Initialize digital asset characteristics
            vm.isDigital = true;
            vm.digitalChars.push(ProductSpec.createCharacteristic({
                name: "Asset type",
                description: "Type of the digital asset described in this product specification"
            }));
            vm.digitalChars[0].productSpecCharacteristicValue = [];
            vm.digitalChars[0].productSpecCharacteristicValue.push(ProductSpec.createCharacteristicValue({
                default: true,
                value: "Basic Service"
            }));
            vm.digitalChars.push(ProductSpec.createCharacteristic({
                name: "Media type",
                description: "Media type of the digital asset described in this product specification"
            }));
            vm.digitalChars[1].productSpecCharacteristicValue.push(ProductSpec.createCharacteristicValue({
                default: true
            }));
            vm.digitalChars.push(ProductSpec.createCharacteristic({
                name: "Location",
                description: "URL pointing to the digital asset described in this product specification"
            }));
        }

        function resetData(){
            vm.data = null;
            vm.digitalChars = [];
            vm.characteristics = [];
            vm.data = ProductSpec.buildInitialData();
            initializeCharacteristic();
        }


        function registerCkanPackage(packageName, productNumber){
            var proxyServerUrl = 'http://127.0.0.1:5000/ckan/package/description'
            var postData = {'url': vm.datastore.baseUrl, 'id':packageName}
            $http.post(proxyServerUrl, postData).then(function successCallback(response){
                resetData();
                vm.data.name = packageName;
                vm.data.productNumber = productNumber;
                vm.data.description = response.data;
                vm.digitalChars[2].productSpecCharacteristicValue.push(ProductSpec.createCharacteristicValue({
                    default: true,
                    value: vm.datastore.baseUrl + "/dataset/" + packageName
                }));
                saveProduct(vm, createPromise, ProductSpec, $state, $rootScope, Utils, EVENTS);
            });
        }

        Object.defineProperty(create, 'status', {
            get: function () { return createPromise != null ? createPromise.$$state.status : -1; }
        });

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


        function clearFileInput() {
            if (!vm.stepList[4].form.pictureFile) {
                vm.stepList[4].form.pictureFile = {};
            } else {
                // Reset possible previous errors
                vm.stepList[4].form.pictureFile.$invalid = false;
                vm.stepList[4].form.pictureFile.$error = {};
            }
        }

        $scope.$watch(function watchFile(scope) {
            return vm.pictureFile;
        }, function() {
            // Check that the new file is a valid image
            if (vm.pictureFile) {
                vm.clearFileInput();
                vm.stepList[4].form.pictureFile.$dirty = true;

                if (vm.pictureFile.type != 'image/gif' && vm.pictureFile.type != 'image/jpeg' &&
                vm.pictureFile.type != 'image/png' && vm.pictureFile.type != 'image/bmp') {

                    // Set input error
                    vm.stepList[4].form.pictureFile.$invalid = true;
                    vm.stepList[4].form.pictureFile.$error = {
                        format: true
                    };
                    return;
                }

                // Upload the file to the server when it is included in the input
                uploadAsset(vm.pictureFile, vm.pictureFile.type, true, function(result) {
                    vm.data.attachment[0].url = result.content
                }, function() {
                    // The picture cannot be uploaded set error in input
                    vm.stepList[4].form.pictureFile.$invalid = true;
                    vm.stepList[4].form.pictureFile.$error = {
                        upload: true
                    };
                });
            }
        });

    }


    function AssetController($scope, $rootScope, Asset, ProductSpec, Utils, EVENTS) {
        var controller = $scope.vm;
        var form = null;

        var vm = this;

        vm.assetTypes = [];
        vm.digitalChars = [];
        vm.meta = {};
        vm.status = LOADING;

        vm.isSelected = isSelected;
        vm.setCurrentType = setCurrentType;
        vm.getCurrentForm = getCurrentForm;
        vm.initMediaType = initMediaType;
        vm.setForm = setForm;
        /* Meta info management */
        vm.getMetaLabel = getMetaLabel;

        function isSelected(format) {
            return vm.currFormat === format;
        }

        function getMetaLabel(id) {
            return typeof vm.currentType.form[id].label !== 'undefined' ? vm.currentType.form[id].label : id;
        }

        function initMetaData() {
            // Evaluate form field in order to include default values
            if (typeof vm.currentType.form !== 'undefined') {
                for (var id in vm.currentType.form) {
                    if (typeof vm.currentType.form[id].default !== 'undefined') {
                        vm.meta[id] = vm.currentType.form[id].default;
                    }
                }
            }
        }

        function setCurrentType() {
            var i,
                found = false;
            var assetType = vm.digitalChars[0].productSpecCharacteristicValue[0].value;

            for (i = 0; i < vm.assetTypes.length && !found; i++) {
                if (assetType === vm.assetTypes[i].name) {
                    found = true;
                    vm.currentType = vm.assetTypes[i];
                    vm.meta = {};
                    initMetaData();
                }
            }
            vm.currFormat = vm.currentType.formats[0];
        }

        function getCurrentForm() {
            let formFields = [];
            if (vm.currentType.formOrder.length > 0) {
                vm.currentType.formOrder.forEach((key) => {
                    vm.currentType.form[key].id = key;
                    formFields.push(vm.currentType.form[key]);
                })
            } else {
                for (key in vm.currentType.form) {
                    vm.currentType.form[key].id = key;
                    formFields.push(vm.currentType.form[key]);
                }
            }
            return formFields;
        }

        function showAssetError(response) {
            var defaultMessage =
                'There was an unexpected error that prevented your ' + 'digital asset to be registered';
            var error = Utils.parseError(response, defaultMessage);

            $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                error: error
            });
        }

        function save(uploadM, registerM, assetId, scope, callback) {
            var meta = null;

            if (Object.keys(vm.meta).length) {
                meta = vm.meta;
            }

            if (vm.currFormat === 'FILE') {
                // If the format is file, upload it to the asset manager
                uploadM(
                    vm.assetFile,
                    scope,
                    vm.digitalChars[0].productSpecCharacteristicValue[0].value,
                    vm.digitalChars[1].productSpecCharacteristicValue[0].value,
                    false,
                    meta,
                    function(result) {
                        // Set file location
                        vm.digitalChars[2].productSpecCharacteristicValue[0].value = result.content;
                        vm.digitalChars[3].productSpecCharacteristicValue[0].value = result.id;
                        callback();
                    },
                    (response) => showAssetError(response),
                    assetId
                );
            } else if (controller.isDigital && vm.currFormat === 'URL') {
                if(meta !== null && meta !== undefined && meta.idPattern !== undefined){
                    var entity_id = "<entity_id>"
                    var entity_type = ""
                    var idPattern = meta.idPattern.split(":")
                    if (idPattern.length > 6){
                        entity_id = idPattern[6]
                    }
                    entity_type = idPattern[2]
                    var end_point = vm.digitalChars[2].productSpecCharacteristicValue[0].value + "/v2/entities/" + entity_id + "/attrs/" + "<attribute>?type=" + entity_type
                    vm.digitalChars[2].productSpecCharacteristicValue[0].value = end_point
                }
                registerM(
                    vm.digitalChars[2].productSpecCharacteristicValue[0].value,
                    vm.digitalChars[0].productSpecCharacteristicValue[0].value,
                    vm.digitalChars[1].productSpecCharacteristicValue[0].value,
                    meta,
                    (result) => {
                        vm.digitalChars[3].productSpecCharacteristicValue[0].value = result.id;
                        callback();
                    },
                    (response) => showAssetError(response),
                    assetId
                );
            }
        }

        var saveAsset = save.bind(this, Asset.uploadAsset, Asset.registerAsset, null);

        function upgradeAsset(scope, callback) {
            // Get asset id using product id
            Asset.searchByProduct(controller.data.id).then(
                (assetInfo) => {
                    save(Asset.upgradeAsset, Asset.upgradeRegisteredAsset, assetInfo[0].id, scope, callback);
                },
                (err) => {
                    showAssetError(err);
                }
            );
        }

        function getDigitalChars() {
            return vm.digitalChars;
        }

        function getMetaInfo() {
            return vm.meta;
        }

        function initMediaType() {
            if (vm.currentType.mediaTypes.length > 0) {
                vm.digitalChars[1].productSpecCharacteristicValue[0].value = vm.currentType.mediaTypes[0];
            } else {
                vm.digitalChars[1].productSpecCharacteristicValue[0].value = '';
            }
        }

        function setForm(modelForm) {
            form = modelForm;
        }

        function isValidAsset() {
            return form !== null && form.$valid;
        }

        // Inject handler for creating asset
        controller.assetCtl = {
            saveAsset: saveAsset,
            upgradeAsset: upgradeAsset,
            getDigitalChars: getDigitalChars,
            getMetaInfo: getMetaInfo,
            isValidAsset: isValidAsset
        };

        // Get the asset types related to the current scope
        controller.getAssetTypes().then(
            function(typeList) {
                angular.copy(typeList, vm.assetTypes);

                if (typeList.length) {
                    // Initialize digital asset characteristics
                    vm.digitalChars.push(
                        ProductSpec.createCharacteristic({
                            name: 'Asset type',
                            description: 'Type of the digital asset described in this product specification'
                        })
                    );
                    vm.digitalChars[0].productSpecCharacteristicValue.push(
                        ProductSpec.createCharacteristicValue({
                            default: true,
                            value: typeList[0].name
                        })
                    );
                    vm.digitalChars.push(
                        ProductSpec.createCharacteristic({
                            name: 'Media type',
                            description: 'Media type of the digital asset described in this product specification'
                        })
                    );
                    vm.digitalChars[1].productSpecCharacteristicValue.push(
                        ProductSpec.createCharacteristicValue({
                            default: true
                        })
                    );
                    vm.digitalChars.push(
                        ProductSpec.createCharacteristic({
                            name: 'Location',
                            description: 'URL pointing to the digital asset described in this product specification'
                        })
                    );
                    vm.digitalChars[2].productSpecCharacteristicValue.push(
                        ProductSpec.createCharacteristicValue({
                            default: true
                        })
                    );
                    vm.digitalChars.push(
                        ProductSpec.createCharacteristic({
                            name: 'Asset',
                            description: 'ID of the asset being offered as registered in the BAE'
                        })
                    );
                    vm.digitalChars[3].productSpecCharacteristicValue.push(
                        ProductSpec.createCharacteristicValue({
                            default: true
                        })
                    );
                    vm.currentType = typeList[0];
                    vm.currFormat = vm.currentType.formats[0];
                }

                vm.status = LOADED;
            },
            function() {
                vm.errMsg = 'There has been an error trying to retrieve asset type info';
                vm.status = ERROR;
            }
        );
    }

    function ProductCreateController(
        $q,
        $scope,
        $state,
        $rootScope,
        EVENTS,
        PROMISE_STATUS,
        ProductSpec,
        Asset,
        AssetType,
        Utils
    ) {
        /* jshint validthis: true */
        var vm = this;
        var createPromise = null;
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
                title: 'Relationships',
                templateUrl: 'stock/product/create/relationships'
            },
            /*{
                title: 'Terms & Conditions',
                templateUrl: 'stock/product/create/terms'
            },*/
            {
                title: 'Finish',
                templateUrl: 'stock/product/create/finish'
            }
        ];

        vm.STATUS = PROMISE_STATUS;

        vm.data = ProductSpec.buildInitialData();
        vm.stepList = stepList;

        vm.charList = [];
        vm.isDigital = false;
        vm.terms = {};
        vm.extraFiles = [];

        vm.characteristicEnabled = false;
        vm.pictureFormat = 'url';

        vm.create = create;

        vm.toggleBundle = toggleBundle;

        vm.hasProduct = hasProduct;
        vm.toggleProduct = toggleProduct;

        vm.createRelationship = createRelationship;
        vm.removeRelationship = removeRelationship;
        vm.getAssetTypes = getAssetTypes;

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

        vm.loadPictureController = loadPictureController;
        vm.loadFileController = loadFileController;

        function createRelationship(data) {
            var deferred = $q.defer();

            vm.data.productSpecificationRelationship.push(data);
            deferred.resolve(vm.data);

            return deferred.promise;
        }

        function removeRelationship(index) {
            var deferred = $q.defer();

            vm.data.productSpecificationRelationship.splice(index, 1);
            deferred.resolve(vm.data);

            return deferred.promise;
        }

        /* CHARACTERISTICS METHODS */

        function createCharacteristic() {
            vm.characteristics.push(vm.characteristic);
            vm.characteristic = angular.copy(characteristic);
            vm.characteristicValue = angular.copy(characteristicValue);
            vm.characteristicEnabled = false;
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
                    result = characteristicValue.value + ' ' + characteristicValue.unitOfMeasure;
                    break;
                case ProductSpec.VALUE_TYPES.NUMBER_RANGE:
                    result =
                        characteristicValue.valueFrom +
                        ' - ' +
                        characteristicValue.valueTo +
                        ' ' +
                        characteristicValue.unitOfMeasure;
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

        function getAssetTypes() {
            return AssetType.search();
        }

        function filterProduct(product) {
            var i = -1;
            vm.data.bundledProductSpecification.forEach(function(bundledProduct, index) {
                if (bundledProduct.id == product.id) {
                    i = index;
                }
            });
            return i;
        }

        vm.bundleControl = {
            valid: false,
            used: false
        };

        function toggleProduct(product) {
            var index = filterProduct(product);

            if (index !== -1) {
                vm.data.bundledProductSpecification.splice(index, 1);
            } else {
                vm.data.bundledProductSpecification.push(product);
                vm.bundleControl.used = true;
            }

            vm.bundleControl.valid = vm.data.bundledProductSpecification.length >= 2;
        }

        function toggleBundle() {
            if (!vm.data.isBundle) {
                vm.data.bundledProductSpecification.length = 0;
                vm.bundleControl.valid = true;
            } else {
                vm.bundleControl.valid = false;
            }
            vm.bundleControl.used = false;
        }

        function hasProduct(product) {
            return filterProduct(product) > -1;
        }

        function create() {
            if (vm.isDigital) {
                var scope = vm.data.name.replace(/ /g, '');

                if (scope.length > 10) {
                    scope = scope.substr(0, 10);
                }

                vm.assetCtl.saveAsset(scope, saveProduct);
            } else {
                saveProduct();
            }
        }

        Object.defineProperty(create, 'status', {
            get: function() {
                return createPromise != null ? createPromise.$$state.status : -1;
            }
        });

        function saveProduct() {
            // Append product characteristics
            var data = angular.copy(vm.data);
            data.productSpecCharacteristic = angular.copy(vm.characteristics);

            if (vm.isDigital) {
                data.productSpecCharacteristic = data.productSpecCharacteristic.concat(vm.assetCtl.getDigitalChars());
                
                var metaInfo = vm.assetCtl.getMetaInfo();
                if (metaInfo.application_id !== undefined) {
                    // Include the application ID
                    var appId = metaInfo.application_id;
                    var appIdChar = ProductSpec.createCharacteristic({
                        name: 'appId',
                        description: 'Application ID of the data source described in this product specification'
                    });
    
                    appIdChar.productSpecCharacteristicValue.push(ProductSpec.createCharacteristicValue({
                        default: true,
                        value: appId
                    }));
    
                    data.productSpecCharacteristic.push(appIdChar);
                }

                if (metaInfo.service !== undefined) {
                    // Include the Fiware-Service
                    var fiware_service = metaInfo.service;
                    
                    if (fiware_service != "") {
                        var fiware_serviceChar = ProductSpec.createCharacteristic({
                            name: 'Fiware-Service',
                            description: 'Fiware-Service of the data source described in this product specification'
                        });
                    }
                    else{
                        var fiware_serviceChar = ProductSpec.createCharacteristic({
                            name: 'Fiware-Service',
                            description: 'Fiware-Service not required for the data source described in this product specification'
                        });
                    }

                    fiware_serviceChar.productSpecCharacteristicValue.push(ProductSpec.createCharacteristicValue({
                        default: true,
                        value: fiware_service
                    }));
    
                    data.productSpecCharacteristic.push(fiware_serviceChar);
                }
                
            }

            if (vm.terms.title || vm.terms.text) {
                // Include the terms and condition characteristic
                var title = vm.terms.title ? vm.terms.title : 'Terms and Conditions';
                var text = vm.terms.text ? vm.terms.text : vm.terms.title;

                var legalChar = ProductSpec.createCharacteristic({
                    name: 'License',
                    description: text
                });

                legalChar.productSpecCharacteristicValue.push(
                    ProductSpec.createCharacteristicValue({
                        default: true,
                        value: title
                    })
                );

                data.productSpecCharacteristic.push(legalChar);
            }

            vm.extraFiles.forEach(function(extraFile) {
                data.attachment.push({
                    type: extraFile.type,
                    url: extraFile.href
                });
            });

            createPromise = ProductSpec.create(data);
            createPromise.then(
                function(productCreated) {
                    $state.go('stock.product.update', {
                        productId: productCreated.id
                    });
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                        resource: 'product',
                        name: productCreated.name
                    });
                },
                function(response) {
                    var defaultMessage =
                        'There was an unexpected error that prevented the ' + 'system from creating a new product';
                    var error = Utils.parseError(response, defaultMessage);

                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: error
                    });
                }
            );
        }

        function loadPictureController() {
            buildPictureController(vm, $scope, vm.stepList[4].form, Asset);
        }

        function loadFileController() {
            buildFileController(vm, $scope, vm.stepList[4].form, Asset);
        }
    }

    function ProductUpgradeController($state, $rootScope, $element, AssetType, ProductSpec, Utils, EVENTS) {
        var vm = this;
        var form = null;

        vm.isDigital = true;
        vm.data = null;
        vm.assetCtl = null;
        vm.version = '';
        vm.status = LOADING;

        vm.getAssetTypes = getAssetTypes;
        vm.setVersionForm = setVersionForm;
        vm.isValid = isValid;

        vm.upgrade = upgrade;

        function getAssetTypes() {
            // Return the current asset type
            var typeChar = vm.data.productSpecCharacteristic.find((char) => {
                return char.name.toLowerCase() == 'asset type' && char.productSpecCharacteristicValue.length == 1;
            });

            var typeName = typeChar.productSpecCharacteristicValue[0].value;
            return AssetType.detail(typeName.toLowerCase().replace(/ /g, '-'));
        }

        function setVersionForm(versionForm) {
            form = versionForm;
        }

        function isValid() {
            return (
                vm.assetCtl !== null &&
                form !== null &&
                !!form.version &&
                vm.assetCtl.isValidAsset() &&
                form.version.$valid
            );
        }

        function upgrade() {
            $element.modal('hide');
            var scope = vm.data.name.replace(/ /g, '');

            if (scope.length > 10) {
                scope = scope.substr(0, 10);
            }

            vm.assetCtl.upgradeAsset(scope, upgradeProduct);
        }

        function upgradeProduct() {
            // Build JSON to be sent
            var upgradeBody = {
                version: vm.version,
                productSpecCharacteristic: []
            };

            // Include product characteristics
            upgradeBody.productSpecCharacteristic = vm.data.productSpecCharacteristic.filter((char) => {
                return !['asset type', 'media type', 'location'].some((digChar) => {
                    return digChar == char.name.toLocaleLowerCase();
                });
            });

            // Include new digital characteristics
            upgradeBody.productSpecCharacteristic = upgradeBody.productSpecCharacteristic.concat(
                vm.assetCtl.getDigitalChars()
            );

            // Call update method
            ProductSpec.update(
                {
                    id: vm.data.id
                },
                upgradeBody
            ).then(
                (productUpdated) => {
                    $state.go(
                        'stock.product.update',
                        {
                            productId: productUpdated.id
                        },
                        {
                            reload: true
                        }
                    );

                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'upgraded', {
                        resource: 'product',
                        name: productUpdated.name
                    });
                },
                (err) => {
                    var defaultMessage =
                        'There was an unexpected error that prevented the ' + 'system from upgrading the product spec';

                    var error = Utils.parseError(err, defaultMessage);

                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: error
                    });
                }
            );
        }

        $rootScope.$on(ProductSpec.EVENTS.UPGRADE, function(event, data) {
            vm.data = data;
            vm.status = LOADED;
            $element.modal('show');
            $element.on('hide.bs.modal', () => {
                vm.status = LOADING;
            });
        });
    }

    function ProductUpdateController($state, $scope, $rootScope, EVENTS, PROMISE_STATUS, ProductSpec, Utils, Asset) {
        /* jshint validthis: true */
        var digital = false;
        var vm = this;

        vm.STATUS = PROMISE_STATUS;

        vm.$state = $state;
        vm.item = {};
        vm.pictureFormat = 'url';
        vm.extraFiles = [];

        vm.update = update;
        vm.isDigital = isDigital;
        vm.showUpgrade = showUpgrade;
        vm.updateImage = updateImage;
        vm.updateStatus = updateStatus;
        vm.formatCharacteristicValue = formatCharacteristicValue;

        vm.createRelationship = createRelationship;
        vm.removeRelationship = removeRelationship;
        vm.loadPictureController = loadPictureController;

        var detailPromise = ProductSpec.detail($state.params.productId);
        detailPromise.then(
            function(productRetrieved) {
                vm.data = angular.copy(productRetrieved);
                vm.item = productRetrieved;
                vm.extraFiles = productRetrieved.getExtraFiles();
                digital = checkDigital();

                vm.item.productSpecCharacteristic = productRetrieved.productSpecCharacteristic.filter(function(char) {
                    if (char.name.toLowerCase() === 'license') {
                        vm.item.license = {
                            title: char.productSpecCharacteristicValue[0].value,
                            description: char.description
                        };
                        return false;
                    }
                    return true;
                });
            },
            function(response) {
                vm.error = Utils.parseError(response, 'The requested product could not be retrieved');
            }
        );

        Object.defineProperty(vm, 'status', {
            get: function() {
                return detailPromise != null ? detailPromise.$$state.status : -1;
            }
        });

        function isDigital() {
            return digital;
        }

        function checkDigital() {
            var isDigital = false;

            // Check if the product is digital
            if (vm.data.productSpecCharacteristic) {
                isDigital = true;
                ['asset type', 'media type', 'location'].forEach((name) => {
                    isDigital =
                        isDigital &&
                        vm.data.productSpecCharacteristic.some((element) => {
                            return element.name.toLowerCase() == name;
                        });
                });
            }

            return isDigital;
        }

        function showUpgrade() {
            $rootScope.$broadcast(ProductSpec.EVENTS.UPGRADE, vm.data);
        }

        function updateStatus(status) {
            vm.data.lifecycleStatus = status;
            vm.statusUpdated = true;
        }

        var updatePromise = null;

        function executeUpdate(dataUpdated) {
            updatePromise = ProductSpec.update(vm.item, dataUpdated);
            updatePromise.then(
                function(productUpdated) {
                    $state.go(
                        'stock.product.update',
                        {
                            productId: productUpdated.id
                        },
                        {
                            reload: true
                        }
                    );
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                        resource: 'product',
                        name: productUpdated.name
                    });
                },
                function(response) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: Utils.parseError(response, 'Unexpected error trying to update the product spec.')
                    });
                }
            );
        }

        function updateImage() {
            if (!angular.equals(vm.item.attachment[0].url, vm.data.attachment[0].url)) {
                executeUpdate({
                    attachment: vm.data.attachment
                });
            }
        }

        function update() {
            var dataUpdated = {};

            ProductSpec.PATCHABLE_ATTRS.forEach(function(attr) {
                if (!angular.equals(vm.item[attr], vm.data[attr])) {
                    dataUpdated[attr] = vm.data[attr];
                }
            });

            executeUpdate(dataUpdated);
        }

        Object.defineProperty(update, 'status', {
            get: function() {
                return updatePromise != null ? updatePromise.$$state.status : -1;
            }
        });

        function createRelationship(relationship) {
            return vm.item.appendRelationship(relationship).then(function(productSpec) {
                vm.item = productSpec;
                vm.data = angular.copy(productSpec);
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                    message: 'The relationship was created.'
                });
                return productSpec;
            });
        }

        function removeRelationship(index) {
            return vm.item.removeRelationship(index).then(function(productSpec) {
                vm.item = productSpec;
                vm.data = angular.copy(productSpec);
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                    message: 'The relationship was removed.'
                });
                return productSpec;
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

        function loadPictureController() {
            buildPictureController(vm, $scope, vm.form, Asset);
        }
    }
})();
