/**
 *
 */

angular.module('app')
    .controller('UserCtrl', function ($scope, $rootScope, EVENTS, User) {

        $scope.updateProfile = function () {
            $rootScope.$broadcast(EVENTS.PROFILE_UPDATE);
        };

        $scope.isAuthenticated = function () {
            return User.isAuthenticated();
        };

        $scope.signOut = function () {
            return document.signOutForm.submit();
        };
    })
    .controller('UserProfileCtrl', function ($scope, $element, EVENTS, User) {
        var tabIndex = 1;
        var token;

        if (User.isAuthenticated()) {
            token = User.current.bearerToken;
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
    })
    .controller('ShoppingCardCtrl', function ($scope, EVENTS) {
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
    });
