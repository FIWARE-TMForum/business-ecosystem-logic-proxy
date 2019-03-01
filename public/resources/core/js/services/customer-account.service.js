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

    angular.module('app').factory('CustomerAccount', ['$q', '$resource', 'URLS', 'Customer', CustomerAccountService]);

    function CustomerAccountService($q, $resource, URLS, Customer) {
        var CustomerAccount = $resource(
            URLS.CUSTOMER_MANAGEMENT + '/customerAccount/:id',
            {},
            {
                update: { method: 'PUT' },
                updatePartial: { method: 'PATCH' }
            }
        );
        CustomerAccount.prototype.serialize = function serialize() {
            return {
                id: this.id,
                href: this.href,
                name: this.name
            };
        };

        var EVENTS = {};

        var TYPES = {};

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

            CustomerAccount.save(
                resource,
                function(customerAccount) {
                    customerAccount.customer = data.customer;
                    deferred.resolve(customerAccount);
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;
        }

        function detail(id) {
            var deferred = $q.defer();
            var params = {
                id: id
            };

            CustomerAccount.get(
                params,
                function(customerAccount) {
                    Customer.detail(customerAccount.customer.id).then(
                        function(customer) {
                            customerAccount.customer = customer;
                            deferred.resolve(customerAccount);
                        },
                        function(response) {
                            deferred.reject(response);
                        }
                    );
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;
        }

        function launch() {
            var customerAccount = new CustomerAccount(angular.copy(TEMPLATES.CUSTOMER_ACCOUNT));

            customerAccount.customer = Customer.launch();

            return customerAccount;
        }
    }
})();
