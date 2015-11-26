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
        };

        $scope.isActive = function isActive($category) {
            return angular.equals($scope.$categoryActive, $category)
        };

        $scope.showCategory = function showCategory($category) {
            $scope.$categoryActive = $category;
            $rootScope.$broadcast(EVENTS.CATEGORY_SHOW, $category);
        };
    }]);
