/**
 *
 */

angular.module('app')
    .controller('ProductSearchCtrl', function ($scope, $rootScope, EVENTS, User, Product, productParams, productFilters) {

        var isList = false;

        $scope.isListView = function isListView() {
            return isList;
        };

        $scope.setListView = function setListView(state) {
            isList = state;
        };

        $scope.showFilters = function () {
            $rootScope.$broadcast(EVENTS.FILTERS_SHOW, productFilters);
        };

        $scope.loading = true;

        Product.list(User.ROLES.SELLER, productParams).then(function (productList) {
            $scope.loading = false;
            $scope.productList = productList;
        });
    })
    .controller('ProductCreateCtrl', function ($scope, $state, Product, Asset, AssetType) {

        var currentType;

        $scope.assetTypes = [];

        var includeCharacteristic = function(name, description, value) {
            $scope.productInfo.productSpecCharacteristic.push({
                "name": name,
                "description": description,
                "valueType": "string",
                "configurable": false,
                "validFor": {
                    "startDateTime": "",
                    "endDateTime": ""
                },
                "productSpecCharacteristicValue": [
                    {
                        "valueType": "string",
                        "default": true,
                        "value": value,
                        "unitOfMeasure": "",
                        "valueFrom": "",
                        "valueTo": "",
                        "validFor": {
                            "startDateTime": "",
                            "endDateTime": ""
                        }
                    }
                ]
            });
        };

        $scope.getActiveTab = function getActiveTab() {
            return activeTab;
        };

        $scope.setActiveTab = function setActiveTab(active) {
            activeTab = active;
        };

        $scope.setCurrentType = function() {
            var found = false;
            for (var i = 0; i < $scope.assetTypes.length && !found; i++) {
                var assetType = $scope.productInfo.productSpecCharacteristic[0].productSpecCharacteristicValue[0].value;

                if (assetType === $scope.assetTypes[i].name) {
                    found = true;
                    currentType = $scope.assetTypes[i];
                }
            }
            $scope.currFormat = currentType.formats[0];
        };

        $scope.getCurrentType = function() {
            return currentType;
        };

        $scope.isSelected = function isSelected(format) {
            return $scope.currFormat === format;
        };

        var saveProduct = function saveProduct() {
            Product.create($scope.productInfo).then(function (productCreated) {
                $state.go('app.stock.product.update', {
                    productId: productCreated.id
                });
            });
        };

        $scope.createProduct = function () {
            // If the format is file upload it to the asset manager
            if ($scope.currFormat === 'FILE') {
                var reader = new FileReader();

                reader.onload = function(e) {
                    var data = {
                        'content': {
                            'name': $scope.assetFile.name,
                            'data': btoa(e.target.result)
                        },
                        'contentType': $scope.productInfo.productSpecCharacteristic[1].productSpecCharacteristicValue[0].value
                    };
                    Asset.create(data, function(result) {
                        // Set file location
                        $scope.productInfo.productSpecCharacteristic[2].productSpecCharacteristicValue[0].value = result.content;
                        saveProduct();
                    });
                };
                reader.readAsBinaryString($scope.assetFile);
            } else {
                saveProduct();
            }
        };

        $scope.productInfo = {
            version: '0.1',
            bundledProductSpecification: [],
            productSpecCharacteristic: []
        };

        AssetType.list(function (types) {
            $scope.assetTypes = types;

            if (types.length) {
                includeCharacteristic('Asset type', 'Type of the digital asset described in this product specification', '');
                includeCharacteristic('Media type', 'Media type of the digital asset described in this product specification', '');
                includeCharacteristic('Location', 'URL pointing to the digital asset described in this product specification', '');
                currentType = types[0];
                $scope.currFormat = currentType.formats[0];
                $scope.productInfo.productSpecCharacteristic[0].productSpecCharacteristicValue[0].value = types[0].name;
            }
        });
    })
    .controller('ProductUpdateCtrl', function ($scope, $state, Product) {

        $scope.updateProduct = function () {
            Product.update($scope.productInfo, function (productUpdated) {
                $state.go('app.stock.product.update', {
                    productId: productUpdated.id,
                    reload: true
                });
            });
        };

        $scope.loading = true;

        Product.get($state.params.productId).then(function (product) {
            $scope.loading = false;
            $scope.product = product;
            $scope.productInfo = angular.copy(product);
        });
    });
