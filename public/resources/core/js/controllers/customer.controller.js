/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */


(function () {

    'use strict';

    angular
        .module('app')
        .controller('CustomerSearchCtrl', CustomerSearchController)
        .controller('CustomerUpdateCtrl', CustomerUpdateController);

    function CustomerSearchController($scope, $rootScope, DATA_STATUS, PROMISE_STATUS, EVENTS, Utils, Customer) {
        /* jshint validthis: true */
        var vm = this;
        var updateCustomerPromise = null;

        vm.STATUS = PROMISE_STATUS;

        vm.list = [];
        vm.status = DATA_STATUS.LOADING;

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

        Customer.search().then(function (customers) {
            vm.list = customers;
            vm.status = DATA_STATUS.LOADED;
        }, function (response) {
            vm.errorMessage = Utils.parseError(response, 'Unexpected error trying to retrieve the list of shipping address.');
            vm.status = DATA_STATUS.ERROR;
        });

        function updateCustomer(index) {
            $rootScope.$broadcast(Customer.EVENTS.CUSTOMER_UPDATE, vm.list[index]);
        }

        Object.defineProperty(updateCustomer, 'status', {
            get: function () { return updateCustomerPromise != null ? updateCustomerPromise.$$state.status : -1; }
        });
    }

    function CustomerUpdateController($element, $scope, $rootScope, $controller, EVENTS, COUNTRIES, Utils, Customer) {
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
