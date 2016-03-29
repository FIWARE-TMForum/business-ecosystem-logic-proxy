/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */


(function () {

    'use strict';

    angular
        .module('app')
        .controller('IndividualUpdateCtrl', IndividualUpdateController);

    function IndividualUpdateController($state, $scope, $rootScope, EVENTS, COUNTRIES, Utils, Individual, User) {
        /* jshint validthis: true */
        var vm = this;

        $scope.COUNTRIES = COUNTRIES;

        vm.contactMediums = [];
        vm.update = update;

        vm.formatContactMedium = formatContactMedium;
        vm.updateContactMedium = updateContactMedium;
        vm.toggleContactMedium = toggleContactMedium;
        vm.removeContactMedium = removeContactMedium;

        $scope.$on(EVENTS.CONTACT_MEDIUM_CREATED, function (event, contactMedium) {
            vm.data.contactMedium.push(contactMedium);
            updateIndividual('settings.contact', 'The contact medium was created.', 'Unexpected error trying to create the contact medium.');
        });

        $scope.$on(EVENTS.CONTACT_MEDIUM_UPDATED, function (event, contactMedium) {
            updateIndividual('settings.contact', 'The contact medium was updated.', 'Unexpected error trying to update the contact medium.');
        });

        Individual.detail(User.loggedUser.id).then(function (individualRetrieved) {
            retrieveIndividual(individualRetrieved);
        }, function (response) {

            if (response.status === 404) {
                retrieveIndividual();
            } else {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to retrieve your personal information.')
                });
            }
        });

        function retrieveIndividual(individual) {

            if (individual == null) {
                individual = Individual.launch();
                vm.isNotCreated = true;
            }

            vm.item = individual;
            vm.data = angular.copy(individual);
            vm.data.birthDate = new Date(vm.data.birthDate);
        }

        function update() {

            Individual[vm.isNotCreated ? 'create' : 'update'](vm.data).then(function () {
                $state.go('settings.general', {}, {
                    reload: true
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                    message: 'Your profile was updated.'
                });
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to update your profile.')
                });
            });
        }

        function updateIndividual(stateName, successMessage, errorMessage) {
            Individual.update(vm.data).then(function () {
                $state.go(stateName, {}, {
                    reload: true
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                    message: successMessage
                });
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, errorMessage)
                });
            });
        }

        function formatContactMedium(contactMedium) {
            var result = '';

            switch (contactMedium.type) {
            case Individual.MEDIUM_TYPES.EMAIL_ADDRESS:
                result += contactMedium.medium.emailAddress;
                break;
            case Individual.MEDIUM_TYPES.TELEPHONE_NUMBER:
                result += [
                    contactMedium.medium.type,
                    contactMedium.medium.number
                ].join(', ');
                break;
            case Individual.MEDIUM_TYPES.POSTAL_ADDRESS:
                result += [
                    contactMedium.medium.streetOne,
                    contactMedium.medium.stateOrProvince,
                    contactMedium.medium.postcode,
                    contactMedium.medium.city,
                    contactMedium.medium.country
                ].join(', ');
                break;
            }

            return result;
        }

        function updateContactMedium(contactMedium) {
            $rootScope.$broadcast(EVENTS.CONTACT_MEDIUM_UPDATE, contactMedium);
        }

        function toggleContactMedium(contactMedium) {
            var index = vm.contactMediums.indexOf(contactMedium);

            if (index !== -1) {
                vm.contactMediums.splice(index, 1);
            } else {
                vm.contactMediums.push(contactMedium);
            }
        }

        function removeContactMedium() {
            vm.contactMediums.forEach(function (contactMedium) {
                vm.data.contactMedium.splice(vm.data.contactMedium.indexOf(contactMedium), 1);
            });
            updateIndividual('settings.contact', 'The contact mediums were removed.', 'Unexpected error trying to remove the contact mediums.');
        }
    }

})();
