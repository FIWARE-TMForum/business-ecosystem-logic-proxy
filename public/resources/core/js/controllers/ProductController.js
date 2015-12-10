/**
 *
 */

angular.module('app.controllers')
    .controller('ProductListCtrl', ['$scope', '$rootScope', 'Product', function ($scope, $rootScope, Product) {

        $scope.getProductPicture = function getProductPicture($product) {
            return Product.getPictureOf($product);
        };

        $scope.productList = Product.$collection;
    }])
    .controller('ProductSearchCtrl', ['$scope', '$rootScope', 'EVENTS', 'Product', function ($scope, $rootScope, EVENTS, Product) {

        $scope.showFilterView = function showFilterView() {
            $rootScope.$broadcast(Product.EVENTS.FILTERVIEW_SHOW);
        };

        $scope.showResultView = function showResultsView($index) {
            $scope.resultView = $index;
        };

        $scope.resultView = 1;
        $scope.searchFailed = false;

        $scope.productList = Product.$collection;
        $scope.productListWaiting = false;

        $scope.$on(Product.EVENTS.FILTER, function ($event, params) {
            $scope.searchFailed = false;
            $scope.productListWaiting = true;

            Product.list(params, function ($collection, wasSearch) {
                $scope.productListWaiting = false;

                if (wasSearch) {
                    $scope.searchFailed = !$collection.length;
                }
            });
        });
    }])
    .controller('ProductSearchFilterCtrl', ['$scope', '$rootScope', '$element', 'Product', function ($scope, $rootScope, $element, Product) {

        var searchProduct = function searchProduct() {
            $rootScope.$broadcast(Product.EVENTS.FILTER, $scope.params);
        };

        $scope.toggleStatus = function toggleStatus(status) {
            var index = $scope.params.status.indexOf(status);

            if (index != -1) {
                $scope.params.status.splice(index, 1);
            } else {
                $scope.params.status.push(status);
            }
        };

        $scope.PRODUCT_TYPES = Product.TYPES;

        $scope.params = {
            status: [Product.STATUS.ACTIVE, Product.STATUS.LAUNCHED]
        };

        $element.on('hidden.bs.modal', function (event) {
            searchProduct();
        });

        $scope.$on(Product.EVENTS.FILTERVIEW_SHOW, function ($event) {
            $element.modal('show');
        });

        searchProduct();
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

        $scope.stepList = [
            {name: 'General'},
            {name: 'Characteristics'},
            {name: 'Assets'},
            {name: 'Finish'}
        ];

        $scope.setStepDisabled = function setStepDisabled($index) {
            return $index != $scope.stepActive && $index > $scope.stepValid;
        };

        $scope.nextStep = function nextStep($index) {
            $scope.stepActive = $index;
            $scope.stepValid = $index;
        };

        $scope.stepActive = 0;
        $scope.stepValid = 0;

        $scope.showStep = function showStep($index) {
            $scope.stepActive = $index;
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

        $scope.showTab = function showTab($index) {
            $scope.tabActive = $index;
        };

        $scope.updateProduct = function updateProduct() {
            Product.update($scope.$product, function ($productUpdated) {
                $element.modal('hide');
                $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', 'The product <strong>{{ name }}</strong> was updated successfully.', $productUpdated);
            });
        };

        $scope.tabList = [
            {title: 'General'},
            {title: 'Characteristics'},
            {title: 'Attachments'}
        ];
        $scope.$product = {};

        $scope.$on(Product.EVENTS.UPDATEVIEW_SHOW, function ($event, $product) {
            angular.copy($product, $scope.$product);
            $scope.showTab(0);

            Product.getBundledProductsOf($scope.$product, function ($bundledProducts) {
            });
        });
    }])
    .controller('ProductView', ['$scope', '$rootScope', 'EVENTS', 'Product', function ($scope, $rootScope, EVENTS, Product) {

        $scope.showSearchView = function showSearchView() {
            $scope.routeActive = '/search';
        };

        $scope.showCreateView = function showCreateView() {
            $scope.routeActive = '/create';
        };

        $scope.showUpdateView = function showUpdateView($product) {
            $scope.routeActive = '/update';
            $rootScope.$broadcast(Product.EVENTS.UPDATEVIEW_SHOW, $product);
        };

        $scope.showSearchView();
    }]);
