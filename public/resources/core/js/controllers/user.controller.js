/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the business-ecosystem-logic-proxy of the
 * Business API Ecosystem
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
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

    function UserController($state, $scope, $rootScope, EVENTS, LIFECYCLE_STATUS, FILTER_STATUS, User, Party) {
        /* jshint validthis: true */
        var vm = this;
        vm.itemsContained = {};

        $scope.STATUS = LIFECYCLE_STATUS;
        $scope.FILTER_STATUS = FILTER_STATUS;
        $scope.$state = $state;

        if (isAuthenticated()) {
            vm.id = User.loggedUser.id;
	    vm.name = User.loggedUser.name;
	    vm.email = User.loggedUser.email;
	    vm.currentUser = User.loggedUser.currentUser;
        }

        vm.order = order;
        vm.contains = contains;
        vm.signOut = signOut;
        vm.showProfile = showProfile;
        vm.isAdmin = isAdmin;
        vm.isSeller = isSeller;
        vm.isAuthenticated = isAuthenticated;
	vm.orgsVisible = orgsVisible;
	vm.orgsInvisible = orgsInvisible;
	vm.loggedAsIndividual = loggedAsIndividual;
	vm.switchSession = switchSession;
	vm.switchToUser = switchToUser;
	vm.showOrgList = showOrgList;
	vm.showOrgs = false;
	vm.hasAdminRole = hasAdminRole;

	function hasAdminRole() {
	    var org = User.loggedUser.organizations.find(x => x.id === vm.currentUser.id);
	    return loggedAsIndividual() || org.roles.findIndex(x => x.name === "Admin") > -1;
	};

	function loggedAsIndividual() {
	    return vm.currentUser.id === User.loggedUser.id;
	};

	function showOrgList(orgId) {
	    return vm.currentUser.id !== orgId;
	};

	function switchSession(orgId) {
	    var currUser = User.loggedUser.organizations.find(x => x.id === orgId);
	    vm.currentUser.name = currUser.name;
	    vm.currentUser.email = currUser.email;
	    vm.currentUser.id = currUser.id;
	    vm.currentUser.href = User.loggedUser.href.replace(/(individual)\/(.*)/g,
							       'organization/' + currUser.id);
	    propagateSwitch();
	};

	function propagateSwitch() {
	    $rootScope.$broadcast(Party.EVENTS.USER_SESSION_SWITCHED, 'User has switched session', {});
	};

	function switchToUser() {
	    vm.currentUser.name = User.loggedUser.name;
	    vm.currentUser.id = User.loggedUser.id;
	    vm.currentUser.email = User.loggedUser.email;
	    vm.currentUser.href = User.loggedUser.href;
	    propagateSwitch();
	};
	
	function orgsVisible() {
	    vm.showOrgs = true;
	};

	function orgsInvisible() {
	    vm.showOrgs = false;
	};

        $scope.$on('$stateChangeSuccess', function (event, toState) {
            $scope.title = toState.data.title;
        });

        function isAdmin() {
            // If admin route is loaded, the user is an admin
            return $state.get('admin') != null;
        }

        function isSeller() {
            // If stock.catalogue route is loaded, the user is a seller
            return $state.get('stock.catalogue') != null;
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

                // Send notification so other views can update its status
                $rootScope.$broadcast(EVENTS.OFFERING_REMOVED);

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
