/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */


(function () {

    'use strict';

    angular
        .module('app')
        .factory('CustomerAccount', CustomerAccountService);

    function CustomerAccountService($q, $resource, URLS, Customer) {
        var CustomerAccount = $resource(URLS.CUSTOMER_MANAGEMENT + '/customerAccount/:id', {}, {
            update: {method: 'PUT'},
            updatePartial: {method: 'PATCH'}
        });
        CustomerAccount.prototype.serialize = function serialize() {
            return {
                id: this.id,
                href: this.href,
                name: this.name
            };
        };

        var EVENTS = {
        };

        var TYPES = {
        };

        var TEMPLATES = {
            CUSTOMER_ACCOUNT: {
                name: '',
                accountType: 'shipping address',
                customer: {}
            }
        };

        return {
            EVENTS: EVENTS,
            TEMPLATES: TEMPLATES,
            TYPES: TYPES,
            create: create,
            detail: detail,
            launch: launch
        };

        function create(data) {
            var deferred = $q.defer();
            var resource = angular.extend({}, data, {
                name: data.customer.name,
                customer: data.customer.serialize()
            });

            CustomerAccount.save(resource, function (customerAccount) {
                customerAccount.customer = data.customer;
                deferred.resolve(customerAccount);
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

            CustomerAccount.get(params, function (customerAccount) {
                Customer.detail(customerAccount.customer.id).then(function (customer) {
                    customerAccount.customer = customer;
                    deferred.resolve(customerAccount);
                }, function (response) {
                    deferred.reject(response);
                });
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function launch() {
            var customerAccount = new CustomerAccount(angular.copy(TEMPLATES.CUSTOMER_ACCOUNT));

            customerAccount.customer = Customer.launch();

            return customerAccount;
        }
    }

})();
