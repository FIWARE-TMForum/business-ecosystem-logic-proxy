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
