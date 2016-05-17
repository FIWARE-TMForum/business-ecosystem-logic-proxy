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

    function IndividualUpdateController($state, $scope, $rootScope, $controller, EVENTS, DATA_STATUS, COUNTRIES, PROMISE_STATUS, Utils, Individual, User) {
        /* jshint validthis: true */
        var vm = this;

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        vm.COUNTRIES = COUNTRIES;
        vm.STATUS = PROMISE_STATUS;

        vm.status = DATA_STATUS.LOADING;
        vm.update = update;
        vm.createContactMedium = createContactMedium;
        vm.updateContactMedium = updateContactMedium;
        vm.removeContactMedium = removeContactMedium;

        $scope.$on(Individual.EVENTS.CONTACT_MEDIUM_UPDATED, function (event, index, contactMedium) {
            updateContactMediumPromise = vm.item.updateContactMedium(index, contactMedium).then(function () {
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

        var updatePromise = null;

        function update() {

            if (vm.isNotCreated) {
                updatePromise = Individual.create(vm.data);
                updatePromise.then(function () {
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
                updatePromise = Individual.update(vm.item, vm.data);
                updatePromise.then(function () {
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

        Object.defineProperty(update, 'status', {
            get: function () { return updatePromise != null ? updatePromise.$$state.status : -1; }
        });

        var createContactMediumPromise = null;

        function createContactMedium(data) {
            createContactMediumPromise = vm.item.appendContactMedium(data);
            createContactMediumPromise.then(function () {
                vm.data.contactMedium.push(data);
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                    message: 'The contact medium was created.'
                });
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to create the contact medium.')
                });
            });

            return createContactMediumPromise;
        }

        Object.defineProperty(createContactMedium, 'status', {
            get: function () { return createContactMediumPromise != null ? createContactMediumPromise.$$state.status : -1; }
        });

        var updateContactMediumPromise = null;

        function updateContactMedium(index) {
            $rootScope.$broadcast(Individual.EVENTS.CONTACT_MEDIUM_UPDATE, index, vm.item.contactMedium[index]);
        }

        Object.defineProperty(updateContactMedium, 'status', {
            get: function () { return updateContactMediumPromise != null ? updateContactMediumPromise.$$state.status : -1; }
        });

        var removeContactMediumPromise = null;

        function removeContactMedium(index) {
            removeContactMediumPromise = vm.item.removeContactMedium(index);
            removeContactMediumPromise.then(function () {
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

        Object.defineProperty(removeContactMedium, 'status', {
            get: function () { return removeContactMediumPromise != null ? removeContactMediumPromise.$$state.status : -1; }
        });

    }

})();
