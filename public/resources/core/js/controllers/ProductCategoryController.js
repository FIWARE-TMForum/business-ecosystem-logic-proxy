/**
 *
 */

angular.module('app')
    .controller('CategoryListCtrl', function ($scope, $state, Category) {

        Category.list($state.params).then(function (categoryList) {
            $scope.categoryList = categoryList;
        });

        Category.breadcrumbOf($state.params.categoryId).then(function (categoryBreadcrumb) {
            $scope.categoryBreadcrumb = categoryBreadcrumb;
        });
    });
