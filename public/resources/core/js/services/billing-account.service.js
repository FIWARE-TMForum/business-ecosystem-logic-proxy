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

    angular
        .module('app')
        .factory('BillingAccount', BillingAccountService);

    function BillingAccountService($q, $resource, URLS, User, CustomerAccount, Customer) {
        var BillingAccount = $resource(URLS.BILLING_MANAGEMENT + '/billingAccount/:id', {}, {
            update: {method: 'PUT'},
            updatePartial: {method: 'PATCH'}
        });
        BillingAccount.prototype.getEmailAddress = function getEmailAddress() {
            return this.customerAccount.customer.getEmailAddress();
        };
        BillingAccount.prototype.getPostalAddress = function getPostalAddress() {
            return this.customerAccount.customer.getPostalAddress();
        };
        BillingAccount.prototype.getTelephoneNumber = function getTelephoneNumber() {
            return this.customerAccount.customer.getTelephoneNumber();
        };
        BillingAccount.prototype.serialize = function serialize() {
            return {
                id: this.id,
                href: this.href
            };
        };

        var EVENTS = {
        };

        var TYPES = {
        };

        var TEMPLATES = {
            BILLING_ACCOUNT: {
                name: '',
                state: 'Defined',
                customerAccount: {},
                relatedParty: []
            }
        };

        return {
            EVENTS: EVENTS,
            TEMPLATES: TEMPLATES,
            TYPES: TYPES,
            search: search,
            create: create,
            detail: detail,
            launch: launch
        };

        function search(filters) {
            var deferred = $q.defer();
            var params = {};

            BillingAccount.query(params, function (billingAccounts) {

                billingAccounts = billingAccounts.filter(function(account) {

                    // TODO: Billing Accounts are filtered and only those where the logged user
                    // has the 'bill received' role are returned. Modify this function in case
                    // another filter is required. At this point, other filters are not expected.
                    return account.relatedParty.some(function(party) {
                        return party.role === 'bill receiver' && party.id === User.loggedUser.id;
                    });

                });

                detailCustomerAccount(billingAccounts).then(function () {
                    deferred.resolve(billingAccounts);
                }, function (response) {
                    deferred.reject(response);
                });
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function create(data) {
            var deferred = $q.defer();

            Customer.create(data.customerAccount.customer).then(function (customer) {
                data.customerAccount.customer = customer;
                CustomerAccount.create(data.customerAccount).then(function (customerAccount) {
                    var user = User.serializeBasic();
                    user.role = 'bill receiver';
                    var resource = angular.extend({}, data, {
                        name: customerAccount.name,
                        customerAccount: customerAccount.serialize(),
                        relatedParty: [user]
                    });

                    BillingAccount.save(resource, function (billingAccount) {
                        billingAccount.customerAccount = customerAccount;
                        deferred.resolve(billingAccount);
                    }, function (response) {
                        deferred.reject(response);
                    });
                }, function (response) {
                    deferred.reject(response);
                });
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function detail(id) {
            var deferred = $q.defer();
            var params = {
                id: id
            };

            BillingAccount.get(params, function (billingAccount) {
                CustomerAccount.detail(billingAccount.customerAccount.id).then(function (customerAccount) {
                    billingAccount.customerAccount = customerAccount;
                    deferred.resolve(billingAccount);
                }, function (response) {
                    deferred.reject(response);
                });
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function detailCustomerAccount(collection) {
            var deferred = $q.defer();
            var keepWaiting = collection.length;

            if (collection.length) {
                collection.forEach(function (billingAccount) {
                    CustomerAccount.detail(billingAccount.customerAccount.id).then(function (customerAccount) {
                        billingAccount.customerAccount = customerAccount;
                        keepWaiting -= 1;

                        if (!keepWaiting) {
                            deferred.resolve(collection);
                        }
                    }, function (response) {
                        deferred.reject(response);
                    });
                });
            } else {
                deferred.resolve(collection);
            }

            return deferred.promise;
        }

        function launch() {
            var billingAccount = new BillingAccount(angular.copy(TEMPLATES.BILLING_ACCOUNT));

            billingAccount.customerAccount = CustomerAccount.launch();

            return billingAccount;
        }
    }

})();
