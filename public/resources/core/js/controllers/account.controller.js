/* Copyright (c) 2015 - 2018 CoNWeT Lab., Universidad Politécnica de Madrid
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

//const { relativeTimeRounding } = require("moment/moment");

/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */
(function() {
    'use strict';

    angular
        .module('app')
        .controller('AccountSearchCtrl', [
            '$scope',
            '$rootScope',
            'DATA_STATUS',
            'EVENTS',
            'Utils',
            'Account',
            'User',
            'Party',
            AccountSearchController
        ])
        .controller('AccountCreateCtrl', [
            '$scope',
            '$rootScope',
            '$controller',
            'COUNTRIES',
            'EVENTS',
            'PROMISE_STATUS',
            'Utils',
            'Account',
            'Party',
            AccountCreateController
        ])
        .controller('AccountUpdateCtrl', [
            '$element',
            '$scope',
            '$rootScope',
            '$controller',
            'COUNTRIES',
            'Account',
            AccountUpdateController
        ]);


    //Parece que o search funciona, por ahora
    function AccountSearchController(
        $scope,
        $rootScope,
        DATA_STATUS, 
        EVENTS,
        Utils, 
        Account,
        User,
        Party
    ) {
        /* jshint validthis: true */
        var vm = this;
        var updateAccountPromise = null;

        vm.list = [];
        vm.status = DATA_STATUS.LOADING;
        vm.canEditOrAdd = canEditOrAdd;
        vm.updateAccount = updateAccount;

        Account.search().then(
            (account) => {
                vm.list = account;
                vm.status = DATA_STATUS.LOADED;
            },
            (response) => {
                vm.errorMessage = Utils.parseError(
                    response,
                    'Unexpected error trying to retrieve the list of billingAccounts.'
                );
                vm.status = DATA_STATUS.ERROR;
            }
        )

        console.log("AccountSearchController primer scope");
        $scope.$on(Account.EVENTS.ACCOUNT_CREATED, function(event, account) {
            vm.list.push(account);
            $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                message: 'The shipping address was created.'
            });
        });
        
        console.log("Segundo scope");
        $scope.$on(Account.EVENTS.ACCOUNT_UPDATED, function(event, account, dataUpdated) {
            updateAccountPromise = Account.update(account, dataUpdated).then(
                function(accountUpdated) {
                    angular.extend(account, accountUpdated);
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                        message: 'The shipping address was updated.'
                    });
                },
                function(response) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: Utils.parseError(response, 'Unexpected error trying to update the shipping address.')
                    });
                }
            );
        });

        console.log("fuera scope");

        $scope.$on(Party.EVENTS.USER_SESSION_SWITCHED, function(event, message, obj) {
            updateShippingList();
        });

        function canEditOrAdd() {
            const response = User.loggedUser.currentUser.id === User.loggedUser.id || Party.hasAdminRole();
            return response;
        }

        updateShippingList();

        function updateShippingList() {
            Account.search().then(
                function(accounts) {
                    vm.list = accounts;
                    vm.status = DATA_STATUS.LOADED;
                },
                function(response) {
                    vm.errorMessage = Utils.parseError(
                        response,
                        'Unexpected error trying to retrieve the list of shipping address.'
                    );
                    vm.status = DATA_STATUS.ERROR;
                }
            );
        }

        function updateAccount(index) {
            $rootScope.$broadcast(Account.EVENTS.ACCOUNT_UPDATE, vm.list[index]);
        }

        Object.defineProperty(updateAccount, 'status', {
            get: function() {
                return updateAccountPromise != null ? updateAccountPromise.$$state.status : -1;
            }
        });

    }

    //Problema por ahora aquí
    function AccountCreateController(
        $scope,
        $rootScope,
        $controller,
        COUNTRIES,
        EVENTS,
        PROMISE_STATUS,
        Utils,
        Account
        //Party
    ) {
        var vm = this;
        var account,
            createPromise = null;

        angular.extend(vm, $controller('FormMixinCtrl', { $scope: $scope }));

        vm.CONTACT_MEDIUM = Account.TYPES.CONTACT_MEDIUM;
        vm.COUNTRIES = COUNTRIES;
        vm.STATUS = PROMISE_STATUS;
        vm.create = create;

        resetData();
        function create(form) {
            //account.contact;
            var contactMediums = [
                vm.emailAddress,
                vm.postalAddress,
                vm.telephoneNumber
            ];

            var contacts = {
                contactMedium: []
            }

            contacts.contactMedium = contactMediums;

            account.contact.push(contacts);

            createPromise = Account.create(account).then(
                function(newAccount) {
                    $rootScope.$broadcast(Account.EVENTS.ACCOUNT_CREATED, newAccount);
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
            account = Account.launch();

            vm.emailAddress = {
                mediumType: vm.CONTACT_MEDIUM.EMAIL_ADDRESS.code,
                preferred: false,
                characteristic: {
                    contactType: vm.CONTACT_MEDIUM.EMAIL_ADDRESS.code,
                    emailAddress: ''
                }
            }

            vm.postalAddress = {
                mediumType: vm.CONTACT_MEDIUM.POSTAL_ADDRESS.code,
                preferred: false,
                characteristic: {
                    contactType: vm.CONTACT_MEDIUM.POSTAL_ADDRESS.code,
                    postCode: '',
                    city: '',
                    country: '',
                    stateOrProvince: '' 
                }
            }

            vm.telephoneNumber = {
                mediumType: vm.CONTACT_MEDIUM.TELEPHONE_NUMBER.code,
                preferred: false,
                characteristic: {
                    contactType: '',
                    phoneNumber: ''
                }
            }
            
        }
    }

    function AccountUpdateController(
        $element,
        $scope,
        $rootScope,
        $controller,
        COUNTRIES,
        Account
    ){
        /* jshint validthis: true */
        var vm = this;
        var _account;

        angular.extend(vm, $controller('FormMixinCtrl', { $scope: $scope }));

        vm.COUNTRIES = COUNTRIES;

        vm.update = update;

        console.log("Para por update Controller");

        $scope.$on(Account.EVENTS.ACCOUNT_UPDATE, function(event, account) {
            _account = account;
            vm.emailAddress = angular.copy(account.getEmailAddress());
            vm.postalAddress = angular.copy(account.getPostalAddress());
            vm.telephoneNumber = angular.copy(account.getTelephoneNumber());
            $element.modal('show');
        });

        function update() {
            $rootScope.$broadcast(Account.EVENTS.ACCOUNT_UPDATED, _account, {
                contactMedium: [vm.emailAddress, vm.postalAddress, vm.telephoneNumber]
            });
        }
    }


})();
