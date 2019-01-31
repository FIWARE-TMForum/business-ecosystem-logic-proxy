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
(function() {
    'use strict';

    angular
        .module('app')
        .controller('BillingAccountSearchCtrl', [
            'DATA_STATUS',
            'Utils',
            'BillingAccount',
            BillingAccountSearchController
        ])
        .controller('BillingAccountCreateCtrl', [
            '$scope',
            '$rootScope',
            '$controller',
            'COUNTRIES',
            'EVENTS',
            'PROMISE_STATUS',
            'Utils',
            'BillingAccount',
            'Customer',
            BillingAccountCreateController
        ]);

    function BillingAccountSearchController(DATA_STATUS, Utils, BillingAccount) {
        /* jshint validthis: true */
        var vm = this;

        vm.list = [];
        vm.status = DATA_STATUS.LOADING;

        BillingAccount.search().then(
            function(billingAccounts) {
                vm.list = billingAccounts;
                vm.status = DATA_STATUS.LOADED;
            },
            function(response) {
                vm.errorMessage = Utils.parseError(
                    response,
                    'Unexpected error trying to retrieve the list of billingAccounts.'
                );
                vm.status = DATA_STATUS.ERROR;
            }
        );
    }

    function BillingAccountCreateController(
        $scope,
        $rootScope,
        $controller,
        COUNTRIES,
        EVENTS,
        PROMISE_STATUS,
        Utils,
        BillingAccount,
        Customer
    ) {
        /* jshint validthis: true */
        var vm = this;
        var billingAccount,
            createPromise = null;

        angular.extend(vm, $controller('FormMixinCtrl', { $scope: $scope }));

        vm.CONTACT_MEDIUM = Customer.TYPES.CONTACT_MEDIUM;
        vm.COUNTRIES = COUNTRIES;
        vm.STATUS = PROMISE_STATUS;
        vm.create = create;

        resetData();

        function create(form) {
            billingAccount.customerAccount.customer.contactMedium = [
                vm.emailAddress,
                vm.postalAddress,
                vm.telephoneNumber
            ];

            createPromise = BillingAccount.create(billingAccount).then(
                function(billingAccount) {
                    $rootScope.$broadcast(Customer.EVENTS.CUSTOMER_CREATED, billingAccount.customerAccount.customer);
                    resetData();
                    vm.resetForm(form);
                },
                function(response) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: Utils.parseError(response, 'Unexpected error trying to create a new shipping address.')
                    });
                }
            );
        }

        Object.defineProperty(create, 'status', {
            get: function() {
                return createPromise != null ? createPromise.$$state.status : -1;
            }
        });

        function resetData() {
            billingAccount = BillingAccount.launch();
            vm.emailAddress = new Customer.ContactMedium({
                type: vm.CONTACT_MEDIUM.EMAIL_ADDRESS.code
            });
            vm.postalAddress = new Customer.ContactMedium({
                type: vm.CONTACT_MEDIUM.POSTAL_ADDRESS.code
            });
            vm.telephoneNumber = new Customer.ContactMedium({
                type: vm.CONTACT_MEDIUM.TELEPHONE_NUMBER.code
            });
        }
    }
})();
