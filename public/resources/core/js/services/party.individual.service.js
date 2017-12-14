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
        .factory('Party', ['$q', '$resource', 'URLS', 'COUNTRIES', 'ROLES', 'User', PartyService]);
    
    function PartyService($q, $resource, URLS, COUNTRIES, ROLES, User) {
	
        var Individual = $resource(URLS.PARTY_MANAGEMENT + '/individual/:id', {}, {
            update: {method: 'PUT'},
            updatePartial: {method: 'PATCH'}
        });

        var Organization = $resource(URLS.PARTY_MANAGEMENT + '/organization/:id', {}, {
            update: {method: 'PUT'},
            updatePartial: {method: 'PATCH'}
        });

        Individual.prototype.appendContactMedium = appendContactMedium;
        Individual.prototype.updateContactMedium = updateContactMedium;
        Individual.prototype.removeContactMedium = removeContactMedium;

        Organization.prototype.appendContactMedium = appendContactMedium;
        Organization.prototype.updateContactMedium = updateContactMedium;
        Organization.prototype.removeContactMedium = removeContactMedium;

        var EVENTS = {
            CONTACT_MEDIUM_CREATED: '$contactMediumCreated',
            CONTACT_MEDIUM_UPDATE: '$contactMediumUpdate',
            CONTACT_MEDIUM_UPDATED: '$contactMediumUpdated',
            USER_SESSION_SWITCHED: '$userSessionSwitched'
        };

        var TYPES = {
            CONTACT_MEDIUM: {
                EMAIL_ADDRESS: {code: 'Email', name: 'Email address'},
                TELEPHONE_NUMBER: {code: 'TelephoneNumber', name: 'Telephone number'},
                POSTAL_ADDRESS: {code: 'PostalAddress', name: 'Postal address'}
            }
        };

        var TEMPLATES = {
            EMAIL_ADDRESS: {
                emailAddress: ''
            },
            TELEPHONE_NUMBER: {
                type: '',
                number: ''
            },
            POSTAL_ADDRESS: {
                streetOne: '',
                postcode: '',
                city: '',
                country: '',
                stateOrProvince: ''
            },
            CONTACT_MEDIUM: {
                preferred: false,
                type: TYPES.CONTACT_MEDIUM.EMAIL_ADDRESS.code,
                medium: {}
            }
        };

        var ContactMedium = function ContactMedium(data) {
            angular.merge(this, TEMPLATES.CONTACT_MEDIUM, data);
        };

        ContactMedium.prototype.getType = function getType() {
            var key;

            for (key in TYPES.CONTACT_MEDIUM) {
                if (TYPES.CONTACT_MEDIUM[key].code === this.type) {
                    return TYPES.CONTACT_MEDIUM[key];
                }
            }

            return null;
        };

        ContactMedium.prototype.resetMedium = function resetMedium() {

            switch (this.type) {
            case TYPES.CONTACT_MEDIUM.EMAIL_ADDRESS.code:
                this.medium = angular.copy(TEMPLATES.EMAIL_ADDRESS);
                break;
            case TYPES.CONTACT_MEDIUM.POSTAL_ADDRESS.code:
                this.medium = angular.copy(TEMPLATES.POSTAL_ADDRESS);
                break;
            case TYPES.CONTACT_MEDIUM.TELEPHONE_NUMBER.code:
                this.medium = angular.copy(TEMPLATES.TELEPHONE_NUMBER);
                break;
            }

            return this;
        };

        ContactMedium.prototype.toString = function toString() {
            var result = '';

            switch (this.type) {
            case TYPES.CONTACT_MEDIUM.EMAIL_ADDRESS.code:
                result = this.medium.emailAddress;
                break;
            case TYPES.CONTACT_MEDIUM.POSTAL_ADDRESS.code:
                result = this.medium.streetOne + '\n' + this.medium.postcode + ' ' + this.medium.city + ' (' + this.medium.stateOrProvince + ')\n' + parseCountry(this.medium.country);
                break;
            case TYPES.CONTACT_MEDIUM.TELEPHONE_NUMBER.code:
                result = [
                    this.medium.type,
                    this.medium.number
                ].join(', ');
                break;
            }

            return result;
        };

        return {
            EVENTS: EVENTS,
            TEMPLATES: TEMPLATES,
            TYPES: TYPES,
            ContactMedium: ContactMedium,
            create: create,
            detail: detail,
            update: update,
            launch: launch,
            getCurrentOrg: getCurrentOrg,
            hasAdminRole: hasAdminRole,
            isOrganization: isOrganization
        };

        function isOrganization() {
            return User.loggedUser && User.loggedUser.id !== User.loggedUser.currentUser.id;
        }

        function getCurrentOrg() {
            var org = User.loggedUser.currentUser;
            return (isOrganization()) ? User.loggedUser.organizations.find( x => x.id === org.id) : {};
        }

        function hasAdminRole() {
            var org = User.loggedUser.organizations.find(
                x => x.id === User.loggedUser.currentUser.id);

            return org.roles.findIndex(x => x.name === ROLES.orgAdmin) > -1;
        }

        function process(func, params, deferred, transform) {
            // credits to @RockNeurotiko for this tip.
            transform = (transform == null) ? x => x : transform;

            var resol = function (partyObj) {
                transform(partyObj);
                deferred.resolve(partyObj);
            };

            var rejec = function (response) {
                deferred.reject(response);
            };
            params.push(resol, rejec);

            func.apply(null, params);
        }

        function create(data) {
            var deferred = $q.defer();

            if(!isOrganization()){
                process(Individual.save, [data], deferred);
            } else {
                process(Organization.save, [data], deferred);
            }

            return deferred.promise;
        }

        function detail(id) {
            var deferred = $q.defer();
            var params = {
                id: id
            };

            if(!isOrganization()){
                process(Individual.get, [params], deferred, extendContactMedium);
            } else {
                process(Organization.get, [params], deferred, extendContactMedium);
            }
            return deferred.promise;
        }

        function update(entry, data) {
            var deferred = $q.defer();
            var params = {
                id: entry.id
            };

            if(!isOrganization()) {
                process(Individual.update, [params, data], deferred);
            } else {
                process(Organization.update, [params, data], deferred);
            }
            return deferred.promise;
        }

        function updatePartial(entry, data) {
            var deferred = $q.defer();
            var params = {
                id: entry.id
            };

            if (!isOrganization()){
                process(Individual.updatePartial, [params, data], deferred);
            } else {
                process(Organization.updatePartial, [params, data], deferred);
            }

            return deferred.promise;
        }

        function launch() {
            if(!isOrganization()){
                return new Individual({
                    id: User.loggedUser.currentUser.id,
                    birthDate: '',
                    contactMedium: [],
                    countryOfBirth: '',
                    familyName: '',
                    gender: '',
                    givenName: '',
                    maritalStatus: '',
                    nationality: '',
                    placeOfBirth: '',
                    title: ''
                });
            } else {
                // TODO: Add proper fields. But this object should never be created like this, so its ok
                return new Organization({
                    id: "ThisShouldntBeHappeningEver:ERROR!",
                    contactMedium: [],
                    description: ""
                });
            }
        }

        function extendContactMedium(party) {
            if (angular.isArray(party.contactMedium)) {
                party.contactMedium = party.contactMedium.map(function (data) {
                    return new ContactMedium(data);
                });
            } else {
                party.contactMedium = [];
            }
        }

        function parseCountry(code) {
            var i;

            for (i = 0; i < COUNTRIES.length; i++) {
                if (COUNTRIES[i].code === angular.uppercase(code)) {
                    return COUNTRIES[i].name;
                }
            }

            return code;
        }
	
        function appendContactMedium(contactMedium) {
            /* jshint validthis: true */
            var deferred = $q.defer();
            var dataUpdated = {
                contactMedium: this.contactMedium.concat(contactMedium)
            };
	    
            updatePartial(this, dataUpdated, isOrganization()).then(function () {
                this.contactMedium.push(contactMedium);
                deferred.resolve(this);
            }.bind(this), function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function updateContactMedium(index, contactMedium) {
            /* jshint validthis: true */
            var deferred = $q.defer();
            var dataUpdated = {
                contactMedium: this.contactMedium.slice(0)
            };

            dataUpdated.contactMedium[index] = contactMedium;
            updatePartial(this, dataUpdated, isOrganization()).then(function () {
                angular.merge(this.contactMedium[index], contactMedium);
                deferred.resolve(this);
            }.bind(this), function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function removeContactMedium(index) {
            /* jshint validthis: true */
            var deferred = $q.defer();
            var dataUpdated = {
                contactMedium: this.contactMedium.slice(0)
            };

            dataUpdated.contactMedium.splice(index, 1);

            updatePartial(this, dataUpdated, isOrganization()).then(function () {
                this.contactMedium.splice(index, 1);
                deferred.resolve(this);
            }.bind(this), function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }
    }

})();
