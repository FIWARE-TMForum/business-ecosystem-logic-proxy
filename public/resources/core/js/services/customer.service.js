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
        .factory('Customer', CustomerService);

    function CustomerService($q, $resource, URLS, User, Individual) {
        var Customer = $resource(URLS.CUSTOMER_MANAGEMENT + '/customer/:id', {}, {
            update: {method: 'PUT'},
            updatePartial: {method: 'PATCH'}
        });
        Customer.prototype.getEmailAddress = function getEmailAddress() {
            return findContactMedium(this.contactMedium, Individual.TYPES.CONTACT_MEDIUM.EMAIL_ADDRESS.code);
        };
        Customer.prototype.getPostalAddress = function getPostalAddress() {
            return findContactMedium(this.contactMedium, Individual.TYPES.CONTACT_MEDIUM.POSTAL_ADDRESS.code);
        };
        Customer.prototype.getTelephoneNumber = function getTelephoneNumber() {
            return findContactMedium(this.contactMedium, Individual.TYPES.CONTACT_MEDIUM.TELEPHONE_NUMBER.code);
        };
        Customer.prototype.serialize = function serialize() {
            return {
                id: this.id,
                href: this.href,
                name: this.name
            };
        };

        var EVENTS = {
            CUSTOMER_CREATED: '$customerCreated',
            CUSTOMER_UPDATE: '$customerUpdate'
        };

        var TYPES = {
            CONTACT_MEDIUM: Individual.TYPES.CONTACT_MEDIUM
        };

        var TEMPLATES = {
            CUSTOMER: {
                name: '',
                contactMedium: [],
                relatedParty: {}
            },
            CONTACT_MEDIUM: Individual.TEMPLATES.CONTACT_MEDIUM
        };

        return {
            EVENTS: EVENTS,
            TEMPLATES: TEMPLATES,
            TYPES: TYPES,
            ContactMedium: Individual.ContactMedium,
            search: search,
            create: create,
            detail: detail,
            update: update,
            launch: launch
        };

        function search(filters) {
            var deferred = $q.defer();
            var params = {};

            Customer.query(params, function (customers) {
                customers.forEach(extendContactMedium);
                deferred.resolve(customers);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function create(data) {
            var deferred = $q.defer();

            data.name = User.loggedUser.id;
            data.relatedParty = User.serialize();

            Customer.save(data, function (customer) {
                extendContactMedium(customer);
                deferred.resolve(customer);
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

            Customer.get(params, function (customer) {
                extendContactMedium(customer);
                deferred.resolve(customer);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function update(resource, dataUpdated) {
            var deferred = $q.defer();
            var params = {
                id: resource.id
            };

            Customer.updatePartial(params, dataUpdated, function (customer) {
                extendContactMedium(customer);
                deferred.resolve(customer);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function launch() {
            return new Customer(angular.copy(TEMPLATES.CUSTOMER));
        }

        function extendContactMedium(customer) {
            if (angular.isArray(customer.contactMedium)) {
                customer.contactMedium.forEach(function (data, index) {
                    customer.contactMedium[index] = new Individual.ContactMedium(data);
                });
            } else {
                customer.contactMedium = [];
            }
        }

        function findContactMedium(contactMediums, type) {
            var i;

            for (i = 0; i < contactMediums.length; i++) {
                if (angular.equals(contactMediums[i].type, type)) {
                    return contactMediums[i];
                }
            }

            return null;
        }
    }

})();
