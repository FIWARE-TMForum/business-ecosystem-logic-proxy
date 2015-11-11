/**
 * 
 */

angular.module('app.controllers')
    .controller('CategoryListCtrl', ['$scope', '$rootScope', 'EVENTS', 'Category', function ($scope, $rootScope, EVENTS, Category) {

        $scope.$categoryList = Category.$collection;
        $scope.$categoryItem = null;

        $scope.select = function select($category) {

            if ($scope.$categoryItem != null) {
                $scope.$categoryItem.active = false;
            }

            $scope.$catalogueItem = $category;

            if ($category != null) {
                $category.active = true;
            }

            $rootScope.$broadcast(EVENTS.CATEGORY_SHOW, $category);
        };

        $scope.$on(EVENTS.CATEGORY_SELECT, function ($event, $category) {
            $scope.select($category);
        });
    }]);
