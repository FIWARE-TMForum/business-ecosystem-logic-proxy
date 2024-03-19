/* Copyright (c) 2015 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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
(function() {
    'use strict';

    angular
        .module('app')
        .controller('RSModelSearchCtrl', ['$state', '$scope', 'DATA_STATUS', 'RSS', 'Utils', RSModelSearchController])
        .controller('RSModelCreateCtrl', [
            '$state',
            '$rootScope',
            'DATA_STATUS',
            'EVENTS',
            'PLATFORM_REVENUE',
            'RSS',
            'Utils',
            'User',
            RSModelCreateController
        ])
        .controller('RSModelUpdateCtrl', [
            '$state',
            '$rootScope',
            'EVENTS',
            'PLATFORM_REVENUE',
            'DATA_STATUS',
            'RSS',
            'Utils',
            'User',
            RSModelUpdateController
        ])
        .controller('RSModelUpdateSTCtrl', RSModelUpdateSTController);

    function RSModelSearchController($state, $scope, DATA_STATUS, RSS, Utils) {
        var vm = this;
        vm.STATUS = DATA_STATUS;

        vm.offset = -1;
        vm.limit = -1;

        vm.list = [];
        vm.state = $state;
        vm.getElementsLength = getElementsLength;

        function getElementsLength() {
            return Promise.resolve(10)
            //return RSS.countModels();
        }

        function updateRSModels() {
            vm.list.status = vm.STATUS.LOADING;

            if (vm.offset >= 0) {
                var params = {
                    offset: vm.offset,
                    size: vm.limit
                };

                RSS.searchModels(params).then(
                    function(modelsList) {
                        angular.copy(modelsList, vm.list);
                        vm.list.status = DATA_STATUS.LOADED;
                    },
                    function(response) {
                        vm.error = Utils.parseError(
                            response,
                            'It was impossible to load the list of revenue sharing models'
                        );
                        vm.list.status = DATA_STATUS.ERROR;
                    }
                );
            }
        }

        vm.list.status = vm.STATUS.LOADING;

        $scope.$watch(function() {
            return vm.offset;
        }, updateRSModels);
    }

    function calculateTotalPercentage(aggregatorShare, providerShare, currentStValue, stakeholders) {
        var values = [parseFloat(aggregatorShare), parseFloat(providerShare), currentStValue];

        stakeholders.forEach((st) => {
            values.push(st.stakeholderShare);
        });

        var total = values.filter((value) => !isNaN(value)).reduce((val, curr) => {
            return val + curr;
        }, 0);

        return total;
    }

    function buildStakeholdersController(vm, $rootScope, PLATFORM_REVENUE, EVENTS, DATA_STATUS, RSS, Utils, User) {
        vm.selectedProviders = [];

        vm.providers = [];

        vm.stakeholderEnabled = false;
        vm.currentStakeholder = {};
        vm.currentStValue = 0;

        vm.addStakeholder = addStakeholder;
        vm.cancelStakeholder = cancelStakeholder;
        vm.removeStakeholder = removeStakeholder;

        vm.getTotalPercentage = getTotalPercentage;
        vm.searchProviders = searchProviders;

        vm.removeProvider = removeProvider;

        function getTotalPercentage() {
            return calculateTotalPercentage(
                PLATFORM_REVENUE,
                vm.data.providerShare,
                vm.currentStValue,
                vm.data.stakeholders
            );
        }

        function removeProvider(providerId) {
            var index = -1;
            var i = 0;
            var provider;

            while (index == -1 && i < vm.providers.length) {
                if (vm.providers[i].providerId == providerId) {
                    index = i;
                }
                i++;
            }

            if (index > -1) {
                provider = vm.providers.splice(index, 1);
            }
            return provider[0];
        }

        function addStakeholder() {
            // Validate that the total percentage is not over 100
            var total = getTotalPercentage();

            if (total <= 100) {
                vm.data.stakeholders.push({
                    stakeholderId: vm.currentStakeholder.providerId,
                    stakeholderShare: vm.currentStValue
                });

                // The same provider cannot be included twice as an stakeholder
                vm.selectedProviders.push(vm.currentStakeholder);
                removeProvider(vm.currentStakeholder.providerId);
            } else {
                var defaultMessage =
                    'The total percentage exceed 100% (current ' +
                    total +
                    ') ' +
                    'please review your provider and stakeholder values';

                var error = Utils.parseError({ data: null }, defaultMessage);

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

        function cancelStakeholder() {
            vm.currentStValue = 0;
            vm.stakeholderEnabled = false;
        }

        function removeStakeholder(index) {
            vm.data.stakeholders.splice(index, 1);
            var provider = vm.selectedProviders.splice(index, 1)[0];
            vm.providers.push(provider);
            vm.currentStakeholder = vm.providers[0];
        }

        function searchProviders(callback) {
            RSS.searchProviders().then(
                function(providersList) {
                    angular.copy(providersList, vm.providers);

                    // Remove the current user from the provider list since it cannot be a stakeholder of the model
                    removeProvider(User.loggedUser.currentUser.id);

                    if (vm.providers.length) {
                        vm.currentStakeholder = vm.providers[0];
                    }

                    vm.providers.status = DATA_STATUS.LOADED;

                    if (callback) {
                        callback();
                    }
                },
                function(response) {
                    vm.providers.error = Utils.parseError(
                        response,
                        'It was impossible to load the list of available stakeholders'
                    );
                    vm.providers.status = DATA_STATUS.ERROR;
                }
            );
        }
    }

    function RSModelCreateController($state, $rootScope, DATA_STATUS, EVENTS, PLATFORM_REVENUE, RSS, Utils, User) {
        var vm = this;
        vm.stepList = [
            {
                title: 'General',
                templateUrl: 'rss/sharing-models/create/general'
            },
            {
                title: 'Stakeholders',
                templateUrl: 'rss/sharing-models/create/stakeholders'
            },
            {
                title: 'Finish',
                templateUrl: 'rss/sharing-models/create/finish'
            }
        ];

        vm.platformRevenue = PLATFORM_REVENUE;
        vm.data = {
            stakeholders: [],
            algorithmType: 'FIXED_PERCENTAGE',
            providerShare: 0
        };

        vm.create = create;

        buildStakeholdersController(vm, $rootScope, PLATFORM_REVENUE, EVENTS, DATA_STATUS, RSS, Utils, User);

        function create() {
            var total = vm.getTotalPercentage();

            if (total == 100) {
                RSS.createModel(vm.data).then(
                    function(modelCreated) {
                        $state.go('rss.models.update', {
                            productClass: modelCreated.productClass
                        });
                        $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                            resource: 'revenue sharing model',
                            name: modelCreated.productClass
                        });
                    },
                    function(response) {
                        var defaultMessage =
                            'There was an unexpected error that prevented the ' +
                            'system from creating a new revenue sharing model';
                        var error = Utils.parseError(response, defaultMessage, 'exceptionText');

                        $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                            error: error
                        });
                    }
                );
            } else {
                var defaultMessage =
                    'The total percentage must be equal to 100% (current ' +
                    total +
                    ') ' +
                    'please review your provider and stakeholder values';

                var error = Utils.parseError({ data: null }, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            }
        }

        vm.searchProviders();
    }

    function RSModelUpdateController($state, $rootScope, EVENTS, PLATFORM_REVENUE, DATA_STATUS, RSS, Utils, User) {
        var vm = this;

        vm.update = update;
        vm.getSavedPercentage = getSavedPercentage;

        RSS.detailModel($state.params.productClass).then(
            function(sharingModel) {
                vm.data = sharingModel;
                vm.data.providerShare = parseFloat(sharingModel.providerShare)

                vm.status = DATA_STATUS.LOADED;

                buildStakeholdersController(vm, $rootScope, PLATFORM_REVENUE, EVENTS, DATA_STATUS, RSS, Utils, User);
                vm.searchProviders(function() {
                    // Populate stakeholders lists with the actual values
                    for (var i = 0; i < vm.data.stakeholders.length; i++) {
                        var provider = vm.removeProvider(vm.data.stakeholders[i].stakeholderId);
                        vm.selectedProviders.push(provider);
                    }
                });
            },
            function(response) {
                vm.error = Utils.parseError(response, 'The requested revenue sharing model could not be retrieved');
                vm.status = DATA_STATUS.ERROR;
            }
        );

        function getSavedPercentage() {
            return calculateTotalPercentage(vm.data.aggregatorShare, vm.data.providerShare, 0, vm.data.stakeholders);
        }

        function update() {
            var total = calculateTotalPercentage(
                vm.data.aggregatorShare,
                vm.data.providerShare,
                vm.currentStValue,
                vm.data.stakeholders
            );

            if (total == 100) {
                RSS.updateModel(vm.data).then(
                    function(updatedModel) {
                        $state.go(
                            'rss.models.update',
                            {
                                productClass: updatedModel.productClass
                            },
                            {
                                reload: true
                            }
                        );
                        $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                            resource: 'revenue sharing model',
                            name: updatedModel.productClass
                        });
                    },
                    function(response) {
                        var defaultMessage =
                            'There was an unexpected error that prevented the ' +
                            'system from updating the given revenue sharing model';
                        var error = Utils.parseError(response, defaultMessage, 'exceptionText');

                        $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                            error: error
                        });
                    }
                );
            } else {
                var defaultMessage =
                    'The total percentage must be equal to 100% (current ' +
                    total +
                    ') ' +
                    'please review your provider and stakeholder values';

                var error = Utils.parseError({ data: null }, defaultMessage);

                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: error
                });
            }
        }
    }

    function RSModelUpdateSTController() {}
})();
