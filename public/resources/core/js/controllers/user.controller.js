/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .controller('UserCtrl', UserController)
        .controller('UserProfileCtrl', UserProfileController)
        .controller('UserShoppingCartCtrl', UserShoppingCartController);

    function UserController($scope, $rootScope, EVENTS, LIFECYCLE_STATUS, FILTER_STATUS, User, ShoppingCart) {
        /* jshint validthis: true */
        var vm = this;

        $scope.STATUS = LIFECYCLE_STATUS;
        $scope.FILTER_STATUS = FILTER_STATUS;

        if (isAuthenticated()) {
            vm.id = User.loggedUser.id;
        }

        vm.order = order;
        vm.contains = contains;
        vm.signOut = signOut;
        vm.showProfile = showProfile;
        vm.isAuthenticated = isAuthenticated;

        $scope.$on("$stateChangeSuccess", function (event, toState) {
            $scope.title = toState.data.title;
        });

        function isAuthenticated() {
            return User.isAuthenticated();
        }

        function contains(offering) {
            return ShoppingCart.containsItem(offering);
        }

        function order(offering) {
            // Open options modal
            $rootScope.$broadcast(EVENTS.OFFERING_ORDERED, offering);
        }

        function showProfile() {
            $rootScope.$broadcast(EVENTS.PROFILE_OPENED);
        }

        function signOut() {
            return document.signOutForm.submit();
        }
    }

    function UserProfileController($scope, $element, EVENTS, User) {
        var tabIndex = 1;
        var token;

        if (User.isAuthenticated()) {
            token = User.loggedUser.bearerToken;
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
        $scope.$on(EVENTS.PROFILE_OPENED, function() {
            tabIndex = 1;
            User.detail(function(info) {
                $scope.userInfo = info;
                $element.modal('show');
            });
        });
    }

    function UserShoppingCartController($scope, EVENTS, ShoppingCart) {
        /* jshint validthis: true */
        var vm = this;

        vm.remove = remove;
        vm.getItems = getItems;

        $scope.$on(EVENTS.OFFERING_CONFIGURED, function (event, offering) {
            ShoppingCart.addItem(offering);
        });

        function remove(offering) {
            ShoppingCart.removeItem(offering);
        }

        function getItems() {
            return ShoppingCart.getItems();
        }
    }

})();
