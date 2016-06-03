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
        .controller('IndividualUpdateCtrl', IndividualUpdateController);

    function IndividualUpdateController($state, $scope, $rootScope, $controller, EVENTS, DATA_STATUS, COUNTRIES, Utils, Individual, User) {
        /* jshint validthis: true */
        var vm = this;

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        vm.COUNTRIES = COUNTRIES;

        vm.status = DATA_STATUS.LOADING;
        vm.update = update;
        vm.updateContactMedium = updateContactMedium;
        vm.removeContactMedium = removeContactMedium;

        $scope.$on(Individual.EVENTS.CONTACT_MEDIUM_CREATED, function (event, contactMedium) {
            vm.item.appendContactMedium(contactMedium).then(function () {
                vm.data.contactMedium.push(contactMedium);
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                    message: 'The contact medium was created.'
                });
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to create the contact medium.')
                });
            });
        });

        $scope.$on(Individual.EVENTS.CONTACT_MEDIUM_UPDATED, function (event, index, contactMedium) {
            vm.item.updateContactMedium(index, contactMedium).then(function () {
                angular.merge(vm.data.contactMedium[index], contactMedium);
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                    message: 'The contact medium was updated.'
                });
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to update the contact medium.')
                });
            });
        });

        Individual.detail(User.loggedUser.id).then(function (individualRetrieved) {
            retrieveIndividual(individualRetrieved);
        }, function (response) {

            if (response.status === 404) {
                retrieveIndividual();
            } else {
                vm.status = DATA_STATUS.ERROR;
                vm.errorMessage = Utils.parseError(response, 'Unexpected error trying to retrieve your personal information.')
            }
        });

        function retrieveIndividual(individual) {

            if (individual == null) {
                individual = Individual.launch();
                vm.isNotCreated = true;
            }

            vm.status = DATA_STATUS.LOADED;
            vm.item = individual;
            vm.data = angular.copy(individual);
            //vm.data.birthDate = new Date(vm.data.birthDate);
        }

        function update() {

            if (vm.isNotCreated) {
                Individual.create(vm.data).then(function () {
                    $state.go('settings.general', {}, {
                        reload: true
                    });
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                        message: 'Your profile was created.'
                    });
                }, function (response) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: Utils.parseError(response, 'Unexpected error trying to create your profile.')
                    });
                });
            } else {
                Individual.update(vm.item, vm.data).then(function () {
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
        }

        function updateContactMedium(index) {
            $rootScope.$broadcast(Individual.EVENTS.CONTACT_MEDIUM_UPDATE, index, vm.item.contactMedium[index]);
        }

        function removeContactMedium(index) {
            vm.item.removeContactMedium(index).then(function () {
                vm.data.contactMedium.splice(index, 1);
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                    message: 'The contact medium was removed.'
                });
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to remove the contact medium.')
                });
            });
        }
    }

})();
