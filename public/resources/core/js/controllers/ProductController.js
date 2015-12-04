/**
 *
 */

angular.module('app.controllers')
    .controller('ProductListCtrl', ['$scope', '$rootScope', 'EVENTS', 'Product', function ($scope, $rootScope, EVENTS, Product) {

        $scope.$productList = Product.$collection;
        $scope.$productBundleList = [];

        $scope.canCreateBundle = function canCreateBundle() {
            return  $scope.$productBundleList.length > 1;
        };

        $scope.getPicture = function getPicture($product) {
            var i, src = "";

            if ('attachment' in $product) {
                for (i = 0; i < $product.attachment.length && !src.length; i++) {
                    if ($product.attachment[i].type == 'Picture') {
                        src = $product.attachment[i].url;
                    }
                }
            }

            return src;
        };

        $scope.showUpdateForm = function showUpdateForm($product) {
            $rootScope.$broadcast(EVENTS.PRODUCT_UPDATEFORM_SHOW, $product);
        };

        $scope.selectProduct = function selectProduct($product) {
            if ($scope.isSelected($product)) {
                $scope.$productBundleList.splice($scope.$productBundleList.indexOf($product), 1);
            } else {
                $scope.$productBundleList.push($product);
            }
        };

        $scope.isSelected = function isSelected($product) {
            return $scope.$productBundleList.indexOf($product) != -1;
        };

        $scope.$on(EVENTS.PRODUCT_CREATE, function ($event, $productCreated) {
            $scope.$productBundleList.length = 0;
        });
    }])
    .controller('ProductSearchCtrl', ['$scope', '$rootScope', 'EVENTS', 'Product', function ($scope, $rootScope, EVENTS, Product) {

        $scope.$productList = Product.$collection;
        $scope.$productBrandList = [];

        $scope.resultView = 1;

        $scope.params = {};
        $scope.searchFailed = false;

        $scope.showResultView = function showResultsView($index) {
            $scope.resultView = $index;
        };

        $scope.search = function search() {
            $scope.searchFailed = false;

            if ($scope.params.status) {
                Product.filter($scope.params, function ($productList) {
                    $scope.searchFailed = !$productList.length;
                });
            } else {
                Product.list();
            }
        };

        $scope.showCreateForm = function showCreateForm() {
            $rootScope.$broadcast(EVENTS.PRODUCT_CREATEFORM_SHOW);
        };

        Product.getBrands(function ($brandList) {
            angular.copy($brandList, $scope.$productBrandList);
        });
    }])
    .controller('ProductCreateCtrl', ['$scope', '$rootScope', 'EVENTS', 'Product', 'Asset', 'AssetType', '$element',
        function ($scope, $rootScope, EVENTS, Product, Asset, AssetType, $element) {

        var initialInfo = {
            version: '0.1',
            bundledProductSpecification: [],
            productSpecCharacteristic: []
        };
        var activeTab = 1;
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

        var saveProduct = function() {
            Product.create($scope.productInfo, function ($productCreated) {
                $element.modal('hide');
                $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', 'The product <strong>{{ name }}</strong> was successfully created.', $productCreated);
                $rootScope.$broadcast(EVENTS.PRODUCT_CREATE, $productCreated);
            });
        };
        $scope.createProduct = function createProduct() {
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

        $scope.resetCreateForm = function resetCreateForm() {
            activeTab = 1;
            $scope.productInfo = angular.copy(initialInfo);
        };

        $scope.$on(EVENTS.PRODUCT_CREATEFORM_SHOW, function ($event, $productBundleList) {
            AssetType.list(function(types) {
                $scope.assetTypes = types;
                $scope.resetCreateForm();
                angular.copy($productBundleList, $scope.productInfo.bundledProductSpecification);
                if (types.length) {
                    includeCharacteristic('Asset type', 'Type of the digital asset described in this product specification', '');
                    includeCharacteristic('Media type', 'Media type of the digital asset described in this product specification', '');
                    includeCharacteristic('Location', 'URL pointing to the digital asset described in this product specification', '');
                    currentType = types[0];
                    $scope.currFormat = currentType.formats[0];
                    $scope.productInfo.productSpecCharacteristic[0].productSpecCharacteristicValue[0].value = types[0].name;
                }
                $element.modal('show');
            });
        });

        $scope.resetCreateForm();
    }])
    .controller('ProductUpdateCtrl', ['$scope', '$rootScope', 'EVENTS', 'Product', '$element', function ($scope, $rootScope, EVENTS, Product, $element) {

        $scope.$product = {};

        $scope.tabs = [
            {name: 'General'}
        ];

        $scope.showTab = function showTab($index) {
            $scope.tabs.forEach(function (tab) {
                tab.active = false;
            });
            $scope.tabs[$index].active = true;
        };

        $scope.updateProduct = function updateProduct() {
            Product.update($scope.$product, function ($productUpdated) {
                $element.modal('hide');
                $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', 'The product <strong>{{ name }}</strong> was updated successfully.', $productUpdated);
            });
        };

        $scope.$on(EVENTS.PRODUCT_UPDATEFORM_SHOW, function ($event, $product) {
            $scope.$product = $product;

            Product.getBundledProductsOf($product, function ($bundledProducts) {
                $scope.showTab(0);
                $element.modal('show');
            });
        });
    }])
    .controller('ProductView', ['$scope', '$rootScope', 'EVENTS', 'Product', function ($scope, $rootScope, EVENTS, Product) {

        $scope.PRODUCT_TYPES = Product.TYPES;

        Product.list();
    }]);
