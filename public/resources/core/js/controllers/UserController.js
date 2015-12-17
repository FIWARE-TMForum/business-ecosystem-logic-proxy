/**
 *
 */

angular.module('app.controllers')
    .controller('UserCtrl', ['$scope', '$rootScope', 'User', 'EVENTS', function ($scope, $rootScope, User, EVENTS) {

        $scope.$userRole = User.getRole();

        $scope.updateProfile = function() {
            $rootScope.$broadcast(EVENTS.PROFILE_UPDATE);
        };

        $scope.isAuthenticated = function isAuthenticated() {
            return User.isAuthenticated();
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
    }])
    .controller('ShoppingCardCtrl', ['$scope', 'EVENTS', function($scope, EVENTS) {
        var cart = [];

        var searchOffering = function searchOffering(offering) {
            var found = false;
            var index = -1;
            for (var i = 0; i < cart.length && !found; i++) {
                if (cart[i].id === offering.id) {
                    found = true;
                    index = i;
                }
            }
            return index;
        };

        $scope.getShoppingCart = function getShoppingCart() {
            return cart;
        };

        $scope.createOrder = function createOrder() {

        };

        $scope.removeItem = function removeItem(offering) {
            cart.splice(searchOffering(offering), 1);
        };

        $scope.$on(EVENTS.ORDER_ADDITION, function(event, offering) {
            if (searchOffering(offering) === -1) {
                cart.push(offering);
            }
        });

    }]);
