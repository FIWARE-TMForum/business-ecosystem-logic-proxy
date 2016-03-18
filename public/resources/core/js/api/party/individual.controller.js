/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */


(function () {

    'use strict';

    angular
        .module('app')
        .controller('IndividualUpdateCtrl', IndividualUpdateController)
        .controller('ContactMediumUpdateCtrl', ContactMediumUpdateController);

    function IndividualUpdateController($state, $scope, $rootScope, EVENTS, COUNTRIES, Individual) {
        /* jshint validthis: true */
        var vm = this;

        $scope.COUNTRIES = COUNTRIES;

        var emailAddress = {
            emailAddress: ""
        };

        var telephoneNumber = {
            type: "",
            number: ""
        };

        var postalAddress = {
            streetOne: "",
            postcode: "",
            city: "",
            country: "",
            stateOrProvince: ""
        };

        vm.MEDIUM_TYPES = Individual.MEDIUM_TYPES;

        vm.contactMedium = {
            preferred: false,
            type: vm.MEDIUM_TYPES.EMAIL_ADDRESS,
            medium: angular.copy(emailAddress)
        };
        vm.contactMediumSelected = [];

        var STATUS = {
            NOT_FOUND: 404
        };

        Individual.detail().then(function (individualRetrieved) {
            retrieveIndividual(individualRetrieved);
        }, function (response) {
            if (response.status === STATUS.NOT_FOUND) {
                retrieveIndividual();
            } else {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, "Unexpected error trying to retrieve your personal information.")
                });
            }
        });

        vm.createContact = createContact;
        vm.refreshContact = refreshContact;
        vm.formatContact = formatContact;
        vm.toggleContact = toggleContact;
        vm.removeContact = removeContact;
        vm.updateContact = updateContact;

        vm.update = update;

        $scope.$on(EVENTS.CONTACT_MEDIUM_UPDATED, function (event, contactMedium) {
            updateIndividual('settings.contact', "The contact was updated.", "Unexpected error trying to update the contact.");
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
                    message: "Your profile was updated."
                });
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, "Unexpected error trying to update the profile.")
                });
            });
        }

        function updateContact(contact) {
            $rootScope.$broadcast(EVENTS.CONTACT_MEDIUM_UPDATE, contact);
        }

        function toggleContact(contact) {
            var index = vm.contactMediumSelected.indexOf(contact);

            if (index !== -1) {
                vm.contactMediumSelected.splice(index, 1);
            } else {
                vm.contactMediumSelected.push(contact);
            }
        }

        function removeContact() {
            vm.contactMediumSelected.forEach(function (contact) {
                vm.data.contactMedium.splice(vm.data.contactMedium.indexOf(contact), 1);
            });
            updateIndividual('settings.contact', "The contact medium were removed.", "Unexpected error trying to remove the contact medium.");
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

        function formatContact(contact) {
            var result = "";

            switch (contact.type) {
            case vm.MEDIUM_TYPES.EMAIL_ADDRESS:
                result += contact.medium.emailAddress;
                break;
            case vm.MEDIUM_TYPES.TELEPHONE_NUMBER:
                result += [contact.medium.type, contact.medium.number].join(", ");
                break;
            case vm.MEDIUM_TYPES.POSTAL_ADDRESS:
                result += [contact.medium.streetOne, contact.medium.stateOrProvince, contact.medium.postcode, contact.medium.city, contact.medium.country].join(", ");
                break;
            }

            return result;
        }

        function createContact() {
            vm.data.contactMedium.push(vm.contactMedium);
            updateIndividual('settings.contact', "The contact was created.", "Unexpected error trying to create the contact.");
        }

        function refreshContact() {
            switch (vm.contactMedium.type) {
            case vm.MEDIUM_TYPES.EMAIL_ADDRESS:
                vm.contactMedium.medium = angular.copy(emailAddress);
                break;
            case vm.MEDIUM_TYPES.TELEPHONE_NUMBER:
                vm.contactMedium.medium = angular.copy(telephoneNumber);
                break;
            case vm.MEDIUM_TYPES.POSTAL_ADDRESS:
                vm.contactMedium.medium = angular.copy(postalAddress);
                break;
            }
        }
    }

    function ContactMediumUpdateController($state, $scope, $rootScope, $element, EVENTS, COUNTRIES, Individual) {
        /* jshint validthis: true */
        var vm = this;

        vm.MEDIUM_TYPES = Individual.MEDIUM_TYPES;
        vm.contactMedium = null;
        vm.update = update;

        $scope.COUNTRIES = COUNTRIES;

        $scope.$on(EVENTS.CONTACT_MEDIUM_UPDATE, function (event, contactMedium) {
            vm.contactMediumOriginal = contactMedium;
            vm.contactMedium = angular.copy(contactMedium);

            if (vm.contactMedium.medium.number != null && typeof vm.contactMedium.medium.number !== 'number') {
                vm.contactMedium.medium.number = parseInt(vm.contactMedium.medium.number);
            }

            if (vm.contactMedium.medium.postcode != null && typeof vm.contactMedium.medium.postcode !== 'number') {
                vm.contactMedium.medium.postcode = parseInt(vm.contactMedium.medium.postcode);
            }

            $element.modal('show');
        });

        function update() {
            $rootScope.$broadcast(EVENTS.CONTACT_MEDIUM_UPDATED, angular.merge(vm.contactMediumOriginal, vm.contactMedium));
            vm.contactMedium = null;
        }
    }

})();
