/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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

    angular
        .module('app')
        .controller('CustomerSearchCtrl', ['$scope', '$rootScope', 'DATA_STATUS', 'PROMISE_STATUS', 'EVENTS', 'Utils', 'Customer', 'User', 'Party', CustomerSearchController])
        .controller('CustomerUpdateCtrl', ['$element', '$scope', '$rootScope', '$controller', 'COUNTRIES', 'Customer', CustomerUpdateController]);

    function CustomerSearchController($scope, $rootScope, DATA_STATUS, PROMISE_STATUS, EVENTS, Utils, Customer, User, Party) {
        /* jshint validthis: true */
        var vm = this;
        var updateCustomerPromise = null;

        vm.STATUS = PROMISE_STATUS;

        vm.list = [];
        vm.status = DATA_STATUS.LOADING;
	    vm.canEditOrAdd = canEditOrAdd;

        vm.updateCustomer = updateCustomer;

        $scope.$on(Customer.EVENTS.CUSTOMER_CREATED, function (event, customer) {
            vm.list.push(customer);
            $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                message: 'The shipping address was created.'
            });
        });

        $scope.$on(Customer.EVENTS.CUSTOMER_UPDATED, function (event, customer, dataUpdated) {
            updateCustomerPromise = Customer.update(customer, dataUpdated).then(function (customerUpdated) {
                angular.extend(customer, customerUpdated);
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                    message: 'The shipping address was updated.'
                });
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to update the shipping address.')
                });
            });
        });
	
	$scope.$on(Party.EVENTS.USER_SESSION_SWITCHED, function (event, message, obj) {
	    updateShippingList();
	});

	function canEditOrAdd() {
	    return User.loggedUser.currentUser.id === User.loggedUser.id || Party.hasAdminRole();
	}

	updateShippingList();
	
	function updateShippingList() {
            Customer.search().then(function (customers) {
		// vm.list = customers.filter(x =>
		// 			   x.name === User.loggedUser.currentUser.id);
		vm.list = customers;
		vm.status = DATA_STATUS.LOADED;
            }, function (response) {
		vm.errorMessage = Utils.parseError(response, 'Unexpected error trying to retrieve the list of shipping address.');
		vm.status = DATA_STATUS.ERROR;
            });
	}

        function updateCustomer(index) {
            $rootScope.$broadcast(Customer.EVENTS.CUSTOMER_UPDATE, vm.list[index]);
        }

        Object.defineProperty(updateCustomer, 'status', {
            get: function () { return updateCustomerPromise != null ? updateCustomerPromise.$$state.status : -1; }
        });
    }

    function CustomerUpdateController($element, $scope, $rootScope, $controller, COUNTRIES, Customer) {
        /* jshint validthis: true */
        var vm = this;
        var _customer;

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        vm.COUNTRIES = COUNTRIES;

        vm.update = update;

        $scope.$on(Customer.EVENTS.CUSTOMER_UPDATE, function (event, customer) {
            _customer = customer;
            vm.emailAddress = angular.copy(customer.getEmailAddress());
            vm.postalAddress = angular.copy(customer.getPostalAddress());
            vm.telephoneNumber = angular.copy(customer.getTelephoneNumber());
            $element.modal('show');
        });

        function update() {
            $rootScope.$broadcast(Customer.EVENTS.CUSTOMER_UPDATED, _customer, {
                contactMedium: [vm.emailAddress, vm.postalAddress, vm.telephoneNumber]
            });
        }
    }

})();
