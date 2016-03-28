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

    function IndividualService($q, $resource, URLS, User) {
        var Individual = $resource(URLS.PARTY_MANAGEMENT + '/individual/:partyId', {}, {
            update: {method: 'PUT'}
        });

        Individual.prototype.getUser = getUser;

        var MEDIUM_TYPES = {
            EMAIL_ADDRESS: 'email address',
            TELEPHONE_NUMBER: 'telephone number',
            POSTAL_ADDRESS: 'postal address'
        };

        return {
            MEDIUM_TYPES: MEDIUM_TYPES,
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

        function detail(partyId) {
            var deferred = $q.defer();
            var params = {
                partyId: partyId
            };

            Individual.get(params, function (individualRetrieved) {
                deferred.resolve(individualRetrieved);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function update(dataUpdated) {
            var deferred = $q.defer();
            var params = {
                partyId: dataUpdated.id
            };

            Individual.update(params, dataUpdated, function (individualUpdated) {
                deferred.resolve(individualUpdated);
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

        function getUser() {
            return User.loggedUser;
        }
    }

})();
