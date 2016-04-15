/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */


(function () {

    'use strict';

    angular
        .module('app')
        .controller('BillingAccountSearchCtrl', BillingAccountSearchController)
        .controller('BillingAccountCreateCtrl', BillingAccountCreateController);

    function BillingAccountSearchController(DATA_STATUS, Utils, BillingAccount) {
        /* jshint validthis: true */
        var vm = this;

        vm.list = [];
        vm.status = DATA_STATUS.LOADING;

        BillingAccount.search().then(function (billingAccounts) {
            vm.list = billingAccounts;
            vm.status = DATA_STATUS.LOADED;
        }, function (response) {
            vm.errorMessage = Utils.parseError(response, 'Unexpected error trying to retrieve the list of billingAccounts.');
            vm.status = DATA_STATUS.ERROR;
        });
    }

    function BillingAccountCreateController($scope, $rootScope, $controller, COUNTRIES, EVENTS, Utils, BillingAccount, Customer) {
        /* jshint validthis: true */
        var vm = this;
        var billingAccount;

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        vm.CONTACT_MEDIUM = Customer.TYPES.CONTACT_MEDIUM;
        vm.COUNTRIES = COUNTRIES;
        vm.create = create;

        resetData();

        function create(form) {
            billingAccount.customerAccount.customer.contactMedium = [
                vm.emailAddress,
                vm.postalAddress,
                vm.telephoneNumber
            ];

            BillingAccount.create(billingAccount).then(function (billingAccount) {
                $rootScope.$broadcast(Customer.EVENTS.CUSTOMER_CREATED, billingAccount.customerAccount.customer);
                resetData();
                vm.resetForm(form);
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to create a new shipping address.')
                });
            });
        }

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
