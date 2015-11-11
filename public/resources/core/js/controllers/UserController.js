/**
 *
 */

angular.module('app.controllers')
    .controller('UserCtrl', ['$scope', 'LOGGED_USER', function ($scope, LOGGED_USER) {

        $scope.$userRole = LOGGED_USER.ROLE;

        $scope.signOut = function signOut() {
            return document.signOutForm.submit();
        };
    }])
    .controller('UserCustomerView', ['$scope', '$rootScope', 'EVENTS', 'User', 'Catalogue', 'Category', function ($scope, $rootScope, EVENTS, User, Catalogue, Category) {

        Catalogue.list(User.ROLES.CUSTOMER, function () {
            $rootScope.$broadcast(EVENTS.CATALOGUE_SELECT, null);
        });

        Category.list();
    }])
    .controller('UserSellerView', ['$scope', '$rootScope', function ($scope, $rootScope) {

        $scope.$on("$routeChangeStart", function (event, next) {
            $scope.activeController = next.controller;
        });
    }]);
