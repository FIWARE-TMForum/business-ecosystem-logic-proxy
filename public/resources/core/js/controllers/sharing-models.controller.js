/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .controller('RSModelSearchCtrl', RSModelSearchController)
        .controller('RSModelCreateCtrl', RSModelCreateController)
        .controller('RSModelUpdateCtrl', RSModelUpdateController);

    function RSModelSearchController($state, DATA_STATUS, RSS, Utils) {
        var vm = this;

        vm.list = [];
        vm.state = $state;

        RSS.searchModels().then(function (modelsList) {
            angular.copy(modelsList, vm.list);
            vm.list.status = DATA_STATUS.LOADED;
        }, function (response) {
            vm.error = Utils.parseError(response, 'It was impossible to load the list of revenue sharing models');
            vm.list.status = DATA_STATUS.ERROR;
        });
    }

    function RSModelCreateController($state, $rootScope, DATA_STATUS, EVENTS, PLATFORM_REVENUE, RSS, Utils, User) {
        var vm = this;
        var stepList = [
            {
                title: 'General',
                templateUrl: 'stock/sharing-models/create/general'
            },
            {
                title: 'Stakeholders',
                templateUrl: 'stock/sharing-models/create/stakeholders'
            },
            {
                title: 'Finish',
                templateUrl: 'stock/sharing-models/create/finish'
            }
        ];
        var selectedProviders = [];

        vm.stepList = stepList;
        vm.platformRevenue = PLATFORM_REVENUE;
        vm.data = {
            stakeholders: [],
            algorithmType: 'FIXED_PERCENTAGE',
            ownerValue: 0
        };
        vm.stakeholderEnabled = false;
        vm.currentStakeholder = {};
        vm.currentStValue = 0;

        vm.create = create;
        vm.addStakeholder = addStakeholder;
        vm.removeStakeholder = removeStakeholder;

        vm.providers = [];

        vm.getTotalPercentage = getTotalPercentage;

        function removeProvider(providerId) {
            var index = -1;
            var i = 0;

            while (index == -1  && i < vm.providers.length) {
                if (vm.providers[i].providerId == providerId) {
                    index = i;
                }
                i++;
            }

            if (index > -1) {
                vm.providers.splice(index, 1);
            }
        }

        function getTotalPercentage () {
            var total = PLATFORM_REVENUE + vm.data.ownerValue + vm.currentStValue;

            for (var i = 0; i < vm.data.stakeholders.length; i++) {
                total += vm.data.stakeholders[i].modelValue;
            }

            return total;
        }

        function addStakeholder () {
            // Validate that the total percentage is not over 100
            var total = getTotalPercentage();

            if (total <= 100) {
                vm.data.stakeholders.push({
                    stakeholderId: vm.currentStakeholder.providerId,
                    modelValue: vm.currentStValue
                });

                // The same provider cannot be included twice as an stakeholder
                selectedProviders.push(vm.currentStakeholder);
                removeProvider(vm.currentStakeholder.providerId);
            } else {
                var defaultMessage = 'The total percentage exceed 100% (current ' + total + ') ' +
                    'please review your provider and stakeholder values';

                var error = Utils.parseError({data: null}, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            }

            if (vm.providers.length) {
                vm.currentStakeholder = vm.providers[0];
            }
            vm.currentStValue = 0;
            vm.stakeholderEnabled = false;
        }

        function removeStakeholder (index) {
            vm.data.stakeholders.splice(index, 1);
            var provider = selectedProviders.splice(index, 1)[0];
            vm.providers.push(provider);
            vm.currentStakeholder = vm.providers[0];
        }

        function create() {
            var total = getTotalPercentage();

            if (total == 100) {
                RSS.createModel(vm.data).then(function (modelCreated) {
                    $state.go('stock.models');
                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                        resource: 'revenue sharing model',
                        name: modelCreated.productClass
                    });
                }, function (response) {

                    var defaultMessage = 'There was an unexpected error that prevented the ' +
                        'system from creating a new revenue sharing model';
                    var error = Utils.parseError(response, defaultMessage);

                    $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                        error: error
                    });
                });
            } else {
                var defaultMessage = 'The total percentage must be equal to 100% (current ' + total + ') ' +
                    'please review your provider and stakeholder values';

                var error = Utils.parseError({data: null}, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            }
        }

        RSS.searchProviders().then(function (providersList) {
            angular.copy(providersList, vm.providers);

            // Remove the current user from the provider list since it cannot be a stakeholder of the model
            removeProvider(User.loggedUser.id);

            if (vm.providers.length) {
                vm.currentStakeholder = vm.providers[0];
            }

            vm.providers.status = DATA_STATUS.LOADED;
        }, function (response) {
            vm.providers.error = Utils.parseError(response, 'It was impossible to load the list of available stakeholders');
            vm.providers.status = DATA_STATUS.ERROR;
        });
    }

    function RSModelUpdateController () {

    }
})();
