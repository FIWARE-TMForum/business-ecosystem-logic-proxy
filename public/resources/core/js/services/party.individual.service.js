/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */


(function () {

    'use strict';

    angular
        .module('app')
        .factory('Individual', IndividualService);

    function IndividualService($q, $resource, URLS, COUNTRIES, User) {
        var Individual = $resource(URLS.PARTY_MANAGEMENT + '/individual/:id', {}, {
            update: {method: 'PUT'},
            updatePartial: {method: 'PATCH'}
        });

        Individual.prototype.getUser = getUser;
        Individual.prototype.appendContactMedium = appendContactMedium;
        Individual.prototype.updateContactMedium = updateContactMedium;
        Individual.prototype.removeContactMedium = removeContactMedium;

        var EVENTS = {
            CONTACT_MEDIUM_CREATED: '$contactMediumCreated',
            CONTACT_MEDIUM_UPDATE: '$contactMediumUpdate',
            CONTACT_MEDIUM_UPDATED: '$contactMediumUpdated'
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
                result = this.medium.streetOne + ', ' + this.medium.city + '\n' + this.medium.postcode + ', ' + this.medium.stateOrProvince + '\n' + parseCountry(this.medium.country);
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
            launch: launch
        };

        function create(data) {
            var deferred = $q.defer();

            Individual.save(data, function (individualCreated) {
                deferred.resolve(individualCreated);
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

            Individual.get(params, function (individual) {
                extendContactMedium(individual);
                deferred.resolve(individual);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function update(entry, data) {
            var deferred = $q.defer();
            var params = {
                id: entry.id
            };

            Individual.update(params, data, function (individual) {
                deferred.resolve(individual);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function updatePartial(entry, data) {
            var deferred = $q.defer();
            var params = {
                id: entry.id
            };

            Individual.updatePartial(params, data, function (individual) {
                deferred.resolve(individual);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function launch() {
            return new Individual({
                id: User.loggedUser.id,
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
        }

        function extendContactMedium(individual) {

            if (angular.isArray(individual.contactMedium)) {
                individual.contactMedium = individual.contactMedium.map(function (data) {
                    return new ContactMedium(data);
                });
            } else {
                individual.contactMedium = [];
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

        function getUser() {
            return User.loggedUser;
        }

        function appendContactMedium(contactMedium) {
            /* jshint validthis: true */
            var deferred = $q.defer();
            var dataUpdated = {
                contactMedium: this.contactMedium.concat(contactMedium)
            };

            updatePartial(this, dataUpdated).then(function () {
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

            updatePartial(this, dataUpdated).then(function () {
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

            updatePartial(this, dataUpdated).then(function () {
                this.contactMedium.splice(index, 1);
                deferred.resolve(this);
            }.bind(this), function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

    }

})();
