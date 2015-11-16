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

        $scope.noResults = false;

        $scope.canCreateBundle = function canCreateBundle() {
            return  $scope.$productBundleList.length > 1;
        };

        $scope.getPicture = function getPicture($product) {
            var i, src = "";

            for (i = 0; i < $product.attachment.length; i++) {
                if ($product.attachment[i].type == 'Picture') {
                    return $product.attachment[i].url;
                }
            }

            return src;
        };

        $scope.filterList = function filterList() {
            Product.filter($scope.filters, function ($filteredList) {
                $scope.noResults = !$filteredList.length;
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
    }])
    .controller('ProductView', ['$scope', '$rootScope', 'EVENTS', 'Product', function ($scope, $rootScope, EVENTS, Product) {
        Product.list(function () {
        });
    }]);
