/**
 *
 */

angular.module('app.controllers')
    .controller('UserCtrl', ['$scope', 'User', function ($scope, User) {

        $scope.$userRole = User.getRole();

        $scope.signOut = function signOut() {
            return document.signOutForm.submit();
        };
    }])
    .controller('UserCustomerView', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', 'Category', function ($scope, $rootScope, EVENTS, Catalogue, Category) {

        Catalogue.list(function ($catalogueList) {
            $rootScope.$broadcast(EVENTS.CATALOGUE_SELECT, null);
        });

        Category.list();
    }])
    .controller('UserSellerView', ['$scope', '$rootScope', 'PARTY_ROLES', 'LIFECYCLE_STATUS', 'LIFECYCLE_STATUS_LIST', function ($scope, $rootScope, PARTY_ROLES, LIFECYCLE_STATUS, LIFECYCLE_STATUS_LIST) {

        $scope.PARTY_ROLES = PARTY_ROLES;
        $scope.LIFECYCLE_STATUS = LIFECYCLE_STATUS;
        $scope.LIFECYCLE_STATUS_LIST = LIFECYCLE_STATUS_LIST;

        $scope.$on("$routeChangeStart", function (event, next) {
            $scope.activeController = next.controller;
        });
    }]);
