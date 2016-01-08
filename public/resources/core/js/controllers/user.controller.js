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

    function UserController($scope, $rootScope, EVENTS, LIFECYCLE_STATUS, FILTER_STATUS, User) {
        /* jshint validthis: true */
        var vm = this;
        var offeringList = [];

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

        $scope.$on(EVENTS.OFFERING_REMOVED, function (event, offering) {
            offeringList.splice(getIndexOf(offering, offeringList), 1);
        });

        function isAuthenticated() {
            return User.isAuthenticated();
        }

        function contains(offering) {
            return getIndexOf(offering, offeringList) !== -1;
        }

        function order(offering) {

            if (getIndexOf(offering, offeringList) === -1) {
                offeringList.push(offering);
                $rootScope.$broadcast(EVENTS.OFFERING_ORDERED, offering);
            }
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

    function UserShoppingCartController($scope, $rootScope, EVENTS) {
        /* jshint validthis: true */
        var vm = this;

        vm.list = [];

        vm.remove = remove;

        $scope.$on(EVENTS.OFFERING_ORDERED, function (event, offering) {
            if (getIndexOf(offering, vm.list) === -1) {
                vm.list.push(offering);
            }
        });

        function remove(offering) {
            vm.list.splice(getIndexOf(offering, vm.list), 1);
            $rootScope.$broadcast(EVENTS.OFFERING_REMOVED, offering);
        }
    }

    function getIndexOf(offering, list) {
        var i, index = -1;

        for (i = 0; i < list.length && index === -1; i++) {
            if (list[i].id === offering.id) {
                index = i;
            }
        }

        return index;
    }

})();
