/* Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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

(function() {
    'use strict';

    angular
        .module('app')
        .factory('Account', [
            '$q',
            '$resource',
            'URLS',
            'User',
            'Party',
            AccountService
        ]);

    function AccountService($q, $resource, URLS, User, Party) {
        var Account = $resource(
            URLS.BILLING_MANAGEMENT + 'billingAcount/:accountId',
            {
                accountId: '@accountId'
            },
            {
                save: {
                    method: 'POST',
                    headers: {
                        'X-Terms-Accepted': 'True'
                    }
                },
                update: {
                    method: 'PATCH'
                }
            }
        );

        Account.prototype.getEmailAddress = function getEmailAddress() {
            return findContactMedium(this.contact, Party.TYPES.CONTACT_MEDIUM.EMAIL_ADDRESS.code);
        };

        Account.prototype.serializeEmailAddress = function() {
            const email = this.getEmailAddress();
            return email.characteristic.emailAddress;
        }

        Account.prototype.getPostalAddress = function getPostalAddress() {
            return findContactMedium(this.contact, Party.TYPES.CONTACT_MEDIUM.POSTAL_ADDRESS.code);
        };
        Account.prototype.serializePostalAddress = function() {

            const postarAddress = this.getPostalAddress();

            const result =
                postarAddress.characteristic.street1 +
                '\n' +
                postarAddress.characteristic.postCode +
                ' ' +
                postarAddress.characteristic.city +
                ' (' +
                postarAddress.characteristic.stateOrProvince +
                ')\n' +
                Party.parseCountry(postarAddress.characteristic.country);

            return result;
        }

        Account.prototype.getTelephoneNumber = function getTelephoneNumber() {
            return findContactMedium(this.contact, Party.TYPES.CONTACT_MEDIUM.TELEPHONE_NUMBER.code);
        };
        Account.prototype.serializeTelephoneNumber = function() {
            const phone = this.getTelephoneNumber();
            return phone.characteristic.phoneNumber;
        }

        Account.prototype.serialize = function serialize() {
            return {
                id: this.id,
                href: this.href
            };
        };

        var EVENTS = {
            ACCOUNT_CREATED: '$accountCreated',
            ACCOUNT_UPDATE: '$accountUpdate',
            ACCOUNT_UPDATED: '$accountUpdated'
        };

        var TYPES = {
            CONTACT_MEDIUM: Party.TYPES.CONTACT_MEDIUM
        };

        //var contactMedium = [];

        // Contact e contact medium está mal é unha lista de listas pero non
        //é eso. É unha lista con cousas, este te un contact e eso ten unha lista
        var TEMPLATES = {
            BILLING_ACCOUNT: {
                name: '',
                state: 'Defined',
                contact: [],
                relatedParty: []
            },
            CONTACT_MEDIUM: Party.TEMPLATES.CONTACT_MEDIUM
        };

        function search(filters) {
            var deferred = $q.defer();
            var params = filters == null ? {} : filters;

            Account.query(
                params,
                function(accounts) {
                    accounts.forEach(extendContactMedium);
                    deferred.resolve(accounts);
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;
        }


        function create(data) {
            const deferred = $q.defer();

            var user = User.serializeBasic();
            user.role = 'bill receiver';
            data.relatedParty.push(user);

            Account.save(
                data,
                function(billingCreated) {
                    deferred.resolve(billingCreated);
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;

        }

        function deleteBillingAccount(id) {
            const deferred = $q.defer();
            resource.delete({Id: id},
                function(billingDelete) {
                    deferred.resolve(billingDelete);
                },
                function(response) {
                    deferred.reject(response);
                }
            );
            return deferred.promise;
        }

        function update(resource, data) {
            var deferred = $q.defer();
            var params = {
                accountId: resource.id
            };

            const contactjson = {
                contact: [
                    data
                ]
            }

            console.log("Account service");
            console.log(params.id);
            console.log(data);
            console.log("Fin Account Service");

            Account.update(params, contactjson, 
                function(accountUpdated) {
                    deferred.resolve(accountUpdated);
                },
                function(response) {
                    deferred.reject(response);
                }
            )

            return deferred.promise;
        }

        function extendContactMedium(account) {
            if (angular.isArray(account.contactMedium)) {
                account.contactMedium.forEach(function(data, index) {
                    account.contactMedium[index] = new Party.ContactMedium(data);
                });
            } else {
                account.contactMedium = [];
            }
        }

        function launch() {
            var account = new Account(angular.copy(TEMPLATES.BILLING_ACCOUNT));

            return account;
        }

        function findContactMedium(contacts, type) {
            for (let j = 0; j < contacts.length; j++) {
                for (let i = 0; i < contacts[j].contactMedium.length; i++) {
                    if (angular.equals(contacts[j].contactMedium[i].mediumType, type)) {
                        return contacts[j].contactMedium[i];
                    }
                }
            }

            return null;
        }

        function process(func, params, deferred, transform) {
            transform = transform == null ? (x) => x : transform;

            var resol = function(partyObj) {
                transform(partyObj);
                deferred.resolve(partyObj);
            };

            var rejec = function(response) {
                deferred.reject(response);
            };
            params.push(resol, rejec);

            func.apply(null, params);
        }

        return {
            EVENTS: EVENTS,
            TEMPLATES: TEMPLATES,
            TYPES: TYPES,
            ContactMedium: Party.ContactMedium,
            create: create,
            deleteBillingAccount:deleteBillingAccount,
            update: update,
            search: search,
            launch: launch
        };

    }
})();