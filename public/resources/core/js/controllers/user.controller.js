/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
*          Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    var LOADING = 'LOADING';
    var LOADED = 'LOADED';
    var ERROR = 'ERROR';

    // Cache to avoid asking the server if the item is contained or not several times
    var shoppingCartCache = [];

    angular
        .module('app')
        .controller('UserCtrl', UserController)
        .controller('UserProfileCtrl', UserProfileController)
        .controller('UserShoppingCartCtrl', UserShoppingCartController);

    function UserController($state, $scope, $rootScope, EVENTS, LIFECYCLE_STATUS, FILTER_STATUS, User) {
        /* jshint validthis: true */
        var vm = this;
        vm.itemsContained = {};

        $scope.STATUS = LIFECYCLE_STATUS;
        $scope.FILTER_STATUS = FILTER_STATUS;
        $scope.$state = $state;

        if (isAuthenticated()) {
            vm.id = User.loggedUser.id;
        }

        vm.order = order;
        vm.contains = contains;
        vm.signOut = signOut;
        vm.showProfile = showProfile;
        vm.isAdmin = isAdmin;
        vm.isAuthenticated = isAuthenticated;

        $scope.$on('$stateChangeSuccess', function (event, toState) {
            $scope.title = toState.data.title;
        });

        function isAdmin() {
            return $state.get('admin') != null;
        }

        function isAuthenticated() {
            return User.isAuthenticated();
        }

        function contains(offering) {

            var found = false;

            for (var i = 0; i < shoppingCartCache.length && !found; i++) {
                found = offering.id == shoppingCartCache[i].id;
            }

            return found;
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

    function UserShoppingCartController($rootScope, $scope, EVENTS, ShoppingCart, Utils) {
        /* jshint validthis: true */
        var vm = this;

        vm.list = shoppingCartCache;
        vm.remove = remove;

        $scope.$on(EVENTS.OFFERING_CONFIGURED, function (event, offering) {

            ShoppingCart.addItem(offering).then(function () {

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                    message: 'The offering <strong>' + offering.name + '</strong> was added to your cart.'
                });

                // The list of items in the cart can be updated now!
                updateItemsList();

            }, function (response) {

                var defaultError = 'There was an error that prevented from adding the offering ' +  offering.name +
                    ' to your cart.';

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, defaultError)
                });

                // Update cache - The requests has probably failed because the cache is invalid
                updateItemsList();

            });
        });

        // Once that the order has been created, the items are removed from the cart.
        // Once that the items have been removed, the items cache must be updated.
        $scope.$on(EVENTS.ORDER_CREATED, function() {
            updateItemsList();
        });

        function remove(offering) {

            ShoppingCart.removeItem(offering).then(function() {

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                    message: 'The offering <strong>' + offering.name + '</strong> was removed to your cart.'
                });

                // The list of items in the cart can be updated now!
                updateItemsList();

            }, function (response) {

                var defaultError = 'There was an error that prevented from removing the offering ' + offering.name +
                    ' to your cart.';

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, defaultError)
                });

                // Update cache - The requests has probably failed because the cache is invalid
                updateItemsList();
            });
        }

        function updateItemsList(showLoadError) {

            vm.list.status = LOADING;

            ShoppingCart.getItems().then(function (items) {

                vm.list.splice(0, vm.list.length);  // Empty the list
                vm.list.push.apply(vm.list, items);
                vm.list.status = LOADED;

            }, function (response) {

                vm.list.splice(0, vm.list.length);
                vm.list.status = ERROR;

                if (showLoadError) {

                    var defaultError = 'There was an error while loading your shopping cart.';

                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: Utils.parseError(response, defaultError)
                    });
                }
            });
        }

        // Init the list of items
        updateItemsList(true);
    }

})();
