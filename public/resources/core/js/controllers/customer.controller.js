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

    function CustomerSearchController($scope, $rootScope, DATA_STATUS, EVENTS, Utils, Customer) {
        /* jshint validthis: true */
        var vm = this;

        vm.list = [];
        vm.status = DATA_STATUS.LOADING;

        vm.updateCustomer = updateCustomer;

        $scope.$on(Customer.EVENTS.CUSTOMER_CREATED, function (event, customer) {
            vm.list.push(customer);
            $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                message: 'The shipping address was created.'
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
            var dataUpdated = {
                contactMedium: [vm.emailAddress, vm.postalAddress, vm.telephoneNumber]
            };

            Customer.update(_customer, dataUpdated).then(function (customer) {
                angular.extend(_customer, customer);
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                    message: 'The shipping address was updated.'
                });
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to update the shipping address.')
                });
            });
        }
    }

})();
