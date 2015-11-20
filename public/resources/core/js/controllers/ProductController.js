/**
 *
 */

angular.module('app.controllers')
    .controller('ProductListCtrl', ['$scope', '$rootScope', 'EVENTS', 'Product', function ($scope, $rootScope, EVENTS, Product) {

        $scope.$productList = Product.$collection;
        $scope.$productBundleList = [];

        $scope.$productTypeList = Product.TYPES;
        $scope.$productStatusList = Product.STATUS;
        $scope.$productBrandList = [];

        $scope.filters = {
            type: "",
            status: "",
            brand: ""
        };

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

        $scope.resultsView = 0;

        $scope.changeResultsView = function changeResultsView($index) {
            $scope.resultsView = $index;
        };

        $scope.showCreateForm = function showCreateForm() {
            $rootScope.$broadcast(EVENTS.PRODUCT_CREATEFORM_SHOW, $scope.canCreateBundle() ? $scope.$productBundleList : []);
        };

        $scope.showUpdateForm = function showUpdateForm($product) {
            $rootScope.$broadcast(EVENTS.PRODUCT_UPDATEFORM_SHOW, $product);
        };

        $scope.filterList = function filterList() {
            $scope.$productBundleList.length = 0;
            Product.filter($scope.filters, function ($filteredList) {
            });
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

        Product.getBrands(function ($brands) {
            angular.copy($brands, $scope.$productBrandList);
        });

        $scope.$on(EVENTS.PRODUCT_CREATE, function ($event, $productCreated) {
            $scope.$productBundleList.length = 0;
        });
    }])
    .controller('ProductCreateCtrl', ['$scope', '$rootScope', 'EVENTS', 'Product', '$element', function ($scope, $rootScope, EVENTS, Product, $element) {
        var initialInfo = {version: '0.1', bundledProductSpecification: []};

        $scope.createProduct = function createProduct() {
            Product.create($scope.productInfo, function ($productCreated) {
                $element.modal('hide');
                $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', 'The product <strong>{{ name }}</strong> was created successfully.', $productCreated);
                $rootScope.$broadcast(EVENTS.PRODUCT_CREATE, $productCreated);
            });
        };

        $scope.resetCreateForm = function resetCreateForm() {
            $scope.productInfo = angular.copy(initialInfo);
        };

        $scope.$on(EVENTS.PRODUCT_CREATEFORM_SHOW, function ($event, $productBundleList) {
            $scope.resetCreateForm();
            angular.copy($productBundleList, $scope.productInfo.bundledProductSpecification);
            $element.modal('show');
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
        Product.list(function () {
        });
    }]);
