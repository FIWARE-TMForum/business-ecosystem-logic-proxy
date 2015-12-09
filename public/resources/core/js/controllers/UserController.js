/**
 *
 */

angular.module('app.controllers')
    .controller('UserCtrl', ['$scope', '$rootScope', 'User', 'EVENTS', function ($scope, $rootScope, User, EVENTS) {

        $scope.$userRole = User.getRole();

        $scope.updateProfile = function() {
            $rootScope.$broadcast(EVENTS.PROFILE_UPDATE);
        };

        $scope.signOut = function signOut() {
            return document.signOutForm.submit();
        };
    }])
    .controller('UserCustomerView', ['$scope', '$rootScope', 'EVENTS', 'Catalogue', 'Category', 'Offering',function ($scope, $rootScope, EVENTS, Catalogue, Category, Offering) {

        Catalogue.list(function ($catalogueList) {
            $rootScope.$broadcast(EVENTS.CATALOGUE_SELECT, null);
        });

        Offering.list();
        Category.list();
    }])
    .controller('UserSellerView', ['$scope', '$rootScope', 'PARTY_ROLES', 'LIFECYCLE_STATUS', 'LIFECYCLE_STATUS_LIST', function ($scope, $rootScope, PARTY_ROLES, LIFECYCLE_STATUS, LIFECYCLE_STATUS_LIST) {

        $scope.PARTY_ROLES = PARTY_ROLES;
        $scope.LIFECYCLE_STATUS = LIFECYCLE_STATUS;
        $scope.LIFECYCLE_STATUS_LIST = LIFECYCLE_STATUS_LIST;

        $scope.$on("$routeChangeStart", function (event, next) {
            $scope.activeController = next.controller;
        });
    }])
    .controller('UserProfileCtrl', ['$scope', 'EVENTS', 'User', '$element', '$injector', function($scope, EVENTS, User, $element, $injector){
        var tabIndex = 1;
        var token;

        if ($injector.has('LOGGED_USER')) {
            var LOGGED_USER = $injector.get('LOGGED_USER');
            token = LOGGED_USER.BEARER_TOKEN.split(' ')[1];
        }

        $scope.userInfo = {};

        $scope.getActiveTab = function() {
            return tabIndex;
        };

        $scope.setActiveTab = function(index) {
            tabIndex = index;
        };

        $scope.getAccessToken = function() {
            return token;
        };

        $scope.updateProfile = function() {
            User.updatePartial($scope.userInfo, function() {
                $element.modal('hide');
            });
        };

        // Get userInfo from the server
        $scope.$on(EVENTS.PROFILE_UPDATE, function() {
            tabIndex = 1;
            User.get(function(info) {
                $scope.userInfo = info;
                $element.modal('show');
            });
        });
    }]);
