/* Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
 * 
 * This file belongs to the bbusiness-ecosystem-logic-proxy of the
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
        .controller('ResourceSpecSearchCtrl', [
            '$scope',
            '$state',
            '$rootScope',
            'LIFECYCLE_STATUS',
            'DATA_STATUS',
            'ResourceSpec',
            'Utils',
            'EVENTS',
            ResourceSpecSearchController
        ])
        .controller('ResourceSpecCreateCtrl', [
            '$scope',
            '$state',
            '$rootScope',
            'LIFECYCLE_STATUS',
            'DATA_STATUS',
            'ResourceSpec',
            'Utils',
            'EVENTS',
            ResourceSpecCreateController
        ])
        .controller('ResourceSpecUpdateCtrl', [
            '$scope',
            '$state',
            '$rootScope',
            'LIFECYCLE_STATUS',
            'DATA_STATUS',
            'ResourceSpec',
            'Utils',
            'EVENTS',
            ResourceSpecUpdateController
        ]);

    function ResourceSpecSearchController($scope, $state, $rootScope, LIFECYCLE_STATUS, DATA_STATUS, ResourceSpec, Utils, EVENTS) {
        this.STATUS = DATA_STATUS
        this.status = DATA_STATUS.LOADING

        this.list = []

        this.offset = 0
        this.limit = -1

        this.getElementsLength = getElementsLength;
        this.showFilters = showFilters;

        function getElementsLength() {
            return Promise.resolve(10)
        }

        function showFilters() {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, LIFECYCLE_STATUS);
        }

        this.update = () => {
            // Get resource specifications
            this.status = DATA_STATUS.LOADING
            const params = $state.params

            params.offset = this.offset
            params.limit = this.limit

            ResourceSpec.getResouceSpecs($state.params).then((resources) => {
                this.list = resources
                this.status = this.STATUS.LOADED
            }).catch((response) => {
                this.errorMessage = Utils.parseError(response, 'It was impossible to load the list of resource specs')
                this.status = this.STATUS.ERROR
            })
        }

        $scope.$watch(() => {
            return this.offset;
        }, this.update.bind(this));
    }

    function characteristicsController(ResourceSpec) {
        const buildCharTemplate = () => {
            return angular.copy({
                id: `urn:ngsi-ld:characteristic:${uuid.v4()}`,
                name: '',
                description: '',
                valueType: this.VALUE_TYPES.STRING,
                configurable: false,
                resourceSpecCharacteristicValue: []
            })
        }

        const characteristicValue = {
            isDefault: false,
            unitOfMeasure: '',
            value: '',
            valueFrom: '',
            valueTo: ''
        }

        this.VALUE_TYPES = ResourceSpec.VALUE_TYPES

        this.characteristicEnabled = false
        this.characteristic = buildCharTemplate()

        this.characteristics = []

        this.createCharacteristic = () => {
            this.characteristics.push(this.characteristic);
            this.characteristic = buildCharTemplate()

            this.characteristicValue = angular.copy(characteristicValue);
            this.characteristicEnabled = false;
            return true;
        }

        this.createCharacteristicValue = () => {
            this.characteristicValue.isDefault = this.getDefaultValueOf(this.characteristic) == null;
            this.characteristic.resourceSpecCharacteristicValue.push(this.characteristicValue);
            this.characteristicValue = angular.copy(characteristicValue);

            if (this.characteristic.resourceSpecCharacteristicValue.length > 1) {
                this.characteristic.configurable = true;
            }

            return true;
        }

        this.getFormattedValueOf = (characteristic, characteristicValue) => {
            let result;

            switch (characteristic.valueType) {
                case ResourceSpec.VALUE_TYPES.STRING:
                    result = characteristicValue.value;
                    break;
                case ResourceSpec.VALUE_TYPES.NUMBER:
                    result = characteristicValue.value + ' ' + characteristicValue.unitOfMeasure;
                    break;
                case ResourceSpec.VALUE_TYPES.NUMBER_RANGE:
                    result =
                        characteristicValue.valueFrom +
                        ' - ' +
                        characteristicValue.valueTo +
                        ' ' +
                        characteristicValue.unitOfMeasure;
            }

            return result;
        }

        this.getDefaultValueOf = (characteristic) => {
            let i, defaultValue;

            for (i = 0; i < characteristic.resourceSpecCharacteristicValue.length; i++) {
                if (characteristic.resourceSpecCharacteristicValue[i].isDefault) {
                    defaultValue = characteristic.resourceSpecCharacteristicValue[i];
                }
            }

            return defaultValue;
        }

        this.setDefaultValue = (index) => {
            let value = this.getDefaultValueOf(this.characteristic);

            if (value != null) {
                value.isDefault = false;
            }

            this.characteristic.resourceSpecCharacteristicValue[index].isDefault = true;
        }

        this.removeCharacteristic = (index) => {
            this.characteristics.splice(index, 1);
        }

        this.resetCharacteristicValue = () => {
            this.characteristicValue = angular.copy(characteristicValue);
            this.characteristic.resourceSpecCharacteristicValue.length = 0;
        }

        this.removeCharacteristicValue = (index) => {
            let value = this.characteristic.resourceSpecCharacteristicValue[index];
            this.characteristic.resourceSpecCharacteristicValue.splice(index, 1);

            if (value.isDefault && this.characteristic.resourceSpecCharacteristicValue.length) {
                this.characteristic.resourceSpecCharacteristicValue[0].isDefault = true;
            }

            if (this.characteristic.resourceSpecCharacteristicValue.length <= 1) {
                this.characteristic.configurable = false;
            }
        }
    }

    function ResourceSpecCreateController($scope, $state, $rootScope, LIFECYCLE_STATUS, DATA_STATUS, ResourceSpec, Utils, EVENTS) {
        const charCtl = characteristicsController.bind(this);

        this.STATUS = DATA_STATUS
        this.status = this.STATUS.LOADED

        this.stepList = [
            {
                title: 'General',
                templateUrl: 'stock/resource-spec/create/general'
            },
            {
                title: 'Characteristics',
                templateUrl: 'stock/resource-spec/create/characteristics'
            },
            {
                title: 'Finish',
                templateUrl: 'stock/resource-spec/create/finish'
            }
        ];

        this.data = ResourceSpec.buildInitialData()

        this.create = () => {
            // Create resource specifications
            this.status = DATA_STATUS.PENDING
            this.data.resourceSpecCharacteristic = this.characteristics

            ResourceSpec.createResourceSpec(this.data).then((spec) => {
                this.status = this.STATUS.LOADED

                $state.go('stock.resource.update', {
                    resourceId: spec.id
                });
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
                    resource: 'resource spec',
                    name: spec.name
                });
            }).catch((response) => {
                this.status = this.STATUS.LOADED
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to create the resource specification.')
                });
            })
        }

        charCtl(ResourceSpec)
    }

    function ResourceSpecUpdateController($scope, $state, $rootScope, LIFECYCLE_STATUS, DATA_STATUS, ResourceSpec, Utils, EVENTS) {
        this.STATUS = DATA_STATUS
        this.status = DATA_STATUS.LOADING

        this.updateStatus = DATA_STATUS.LOADED

        this.data = {}
        this.item = {}

        ResourceSpec.getResourceSpec($state.params.resourceId).then((spec) => {
            this.data = angular.copy(spec);

            this.item = spec
            this.status = this.STATUS.LOADED
        }).catch((response) => {
            this.errorMessage = Utils.parseError(response, 'It was impossible to load the resource specification')
            this.status = this.STATUS.ERROR
        })

        this.formatCharacteristicValue = (characteristic, characteristicValue) => {
            let result;

            switch (characteristic.valueType) {
                case "string":
                    result = characteristicValue.value;
                    break;
                case "number":
                    result = characteristicValue.value + ' ' + characteristicValue.unitOfMeasure;
                    break;
                case "number range":
                    result = characteristicValue.valueFrom + ' - ' + characteristicValue.valueTo;
                    result += ' ' + characteristicValue.unitOfMeasure;
                    break;
            }

            return result;
        }

        this.updateStatus = (status) => {
            this.data.lifecycleStatus = status
        }

        this.update = () => {
            const dataUpdated = {};
            ["name", "description", "lifecycleStatus"].forEach((attr) => {
                if (!angular.equals(this.item[attr], this.data[attr])) {
                    dataUpdated[attr] = this.data[attr];
                }
            });

            this.updateStatus = DATA_STATUS.PENDING
            ResourceSpec.updateResourceSpec(this.data.id, dataUpdated).then((updated) => {
                this.updateStatus = DATA_STATUS.LOADED
                $state.go(
                    'stock.resource.update',
                    {
                        resourceId: updated.id
                    },
                    {
                        reload: true
                    }
                );
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                    resource: 'resource spec',
                    name: updated.name
                });
            }).catch((response) => {
                this.updateStatus = DATA_STATUS.LOADED
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to update the resource spec.')
                });
            });
        }
    }
})();