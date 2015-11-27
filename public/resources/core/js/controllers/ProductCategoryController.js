/**
 * 
 */

angular.module('app.controllers')
    .controller('CategoryListCtrl', ['$scope', '$rootScope', 'EVENTS', 'Category', function ($scope, $rootScope, EVENTS, Category) {

        $scope.$categoryList = Category.$collection;
        $scope.$categoryActive = null;

        $scope.refreshList = function refreshList() {
            $scope.$categoryActive = null;
            Category.list();
            $rootScope.$broadcast(EVENTS.CATEGORY_SHOW, null);
        };

        $scope.isActive = function isActive($category) {
            return angular.equals($scope.$categoryActive, $category);
        };

        $scope.showCategory = function showCategory($category) {
            $scope.$categoryActive = $category;
            $rootScope.$broadcast(EVENTS.CATEGORY_SHOW, $category);
        };
    }])
    .controller('CategoryDetailCtrl', ['$scope', '$rootScope', 'EVENTS', 'Category', function ($scope, $rootScope, EVENTS, Category) {

        $scope.$categoryBreadcrumb = [];
        $scope.$categoryActive = null;
        $scope.$subCategoryList = [];

        var _showCategory = function _showCategory($category) {
            $scope.$categoryActive = $category;
            $scope.$subCategoryList = Category.$collectionById[$category.id];
            Category.get($category);
        };

        $scope.isActive = function isActive($category) {
            return angular.equals($scope.$categoryActive, $category);
        };

        $scope.refreshCategory = function refreshCategory($category) {
            $scope.$categoryBreadcrumb.splice($scope.$categoryBreadcrumb.indexOf($category) + 1);
            _showCategory($category);
        };

        $scope.showCategory = function showCategory($category) {
            $scope.$categoryBreadcrumb.push($category);
            _showCategory($category);
        };

        $scope.resetView = function resetView() {
            $scope.$categoryBreadcrumb.length = 0;
            $scope.$categoryActive = null;
            $scope.$subCategoryList.length = 0;
        };

        $scope.$on(EVENTS.CATEGORY_SHOW, function ($event, $category) {
            $scope.resetView();

            if ($category != null) {
                $scope.showCategory($category);
            }
        });
    }]);
