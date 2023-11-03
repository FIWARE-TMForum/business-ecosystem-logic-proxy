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

	const LOADING = 'LOADING';
	const LOADED = 'LOADED';
	const ERROR = 'ERROR';

	angular
		.module('app')
		.controller('ServiceSpecificationListCtrl', [
			'$scope',
			'ServiceSpecification',
			'DATA_STATUS',
			'Utils',
			ServiceSpecificationListController
		])
		.controller('ServiceSpecificationCreateCtrl', [
			'$state',
			'$rootScope',
			'DATA_STATUS',
			'EVENTS',
			'ServiceSpecification',
			'Utils',
			ServiceSpecificationCreateController
		])
		.controller('ServiceSpecificationUpdateCtrl', [
			'$scope',
            '$state',
            '$rootScope',
            'LIFECYCLE_STATUS',
            'DATA_STATUS',
            'ServiceSpecification',
			'Utils',
            'EVENTS',
			ServiceSpecificationUpdateController
		])

	function ServiceSpecificationListController($scope, ServiceSpecification, DATA_STATUS, Utils) {
		var vm = this;

		vm.STATUS = DATA_STATUS
		vm.list = [];
		vm.offset = -1;
		vm.size = -1;
		vm.sidebarInput = '';
		vm.updateList = updateList;
		vm.getElementsLength = getElementsLength;

		function getElementsLength() {
			return Promise.resolve(10)
		}

		function updateList() {
			vm.list.status = LOADING;

			if (vm.offset >= 0) {
				const page = {
					offset: vm.offset,
					size: vm.size,
					body: vm.sidebarInput
				};

				ServiceSpecification.getServiceSpecifications(page).then((itemList) => {
					angular.copy(itemList, vm.list);
					vm.list.status = LOADED;
				}).catch((response) => {
					vm.error = Utils.parseError(response, 'It was impossible to load the list of service specifications');
					vm.list.status = ERROR;
				})
			}
		}

		$scope.$watch(function() {
			return vm.offset;
		}, updateList);
	}

	function characteristicsController() {
        const buildCharTemplate = () => {
            return angular.copy({
                id: `urn:ngsi-ld:characteristic:${uuid.v4()}`,
                name: '',
                description: '',
                valueType: this.VALUE_TYPES.STRING,
                configurable: false,
                characteristicValueSpecification: []
            })
        }

        const characteristicValue = {
            isDefault: false,
            unitOfMeasure: '',
            value: '',
            valueFrom: '',
            valueTo: ''
        }

        this.VALUE_TYPES = {
            STRING: 'string',
            NUMBER: 'number',
            NUMBER_RANGE: 'number range'
        }

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
            this.characteristic.characteristicValueSpecification.push(this.characteristicValue);
            this.characteristicValue = angular.copy(characteristicValue);

            if (this.characteristic.characteristicValueSpecification.length > 1) {
                this.characteristic.configurable = true;
            }

            return true;
        }

        this.getFormattedValueOf = (characteristic, characteristicValue) => {
            let result;

            switch (characteristic.valueType) {
                case this.VALUE_TYPES.STRING:
                    result = characteristicValue.value;
                    break;
                case this.VALUE_TYPES.NUMBER:
                    result = characteristicValue.value + ' ' + characteristicValue.unitOfMeasure;
                    break;
                case this.VALUE_TYPES.NUMBER_RANGE:
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

            for (i = 0; i < characteristic.characteristicValueSpecification.length; i++) {
                if (characteristic.characteristicValueSpecification[i].isDefault) {
                    defaultValue = characteristic.characteristicValueSpecification[i];
                }
            }

            return defaultValue;
        }

        this.setDefaultValue = (index) => {
            let value = this.getDefaultValueOf(this.characteristic);

            if (value != null) {
                value.isDefault = false;
            }

            this.characteristic.characteristicValueSpecification[index].isDefault = true;
        }

        this.removeCharacteristic = (index) => {
            this.characteristics.splice(index, 1);
        }

        this.resetCharacteristicValue = () => {
            this.characteristicValue = angular.copy(characteristicValue);
            this.characteristic.characteristicValueSpecification.length = 0;
        }

        this.removeCharacteristicValue = (index) => {
            let value = this.characteristic.characteristicValueSpecification[index];
            this.characteristic.characteristicValueSpecification.splice(index, 1);

            if (value.isDefault && this.characteristic.characteristicValueSpecification.length) {
                this.characteristic.characteristicValueSpecification[0].isDefault = true;
            }

            if (this.characteristic.characteristicValueSpecification.length <= 1) {
                this.characteristic.configurable = false;
            }
        }
    }

	function ServiceSpecificationCreateController($state, $rootScope, DATA_STATUS, EVENTS, ServiceSpecification, Utils) {
		var vm = this;

		const charCtl = characteristicsController.bind(this)

		this.stepList = [
            {
                title: 'General',
                templateUrl: 'stock/service-specification/create/general'
            },
            {
                title: 'Characteristics',
                templateUrl: 'stock/service-specification/create/characteristics'
            },
            {
                title: 'Finish',
                templateUrl: 'stock/service-specification/create/finish'
            }
        ];

		this.STATUS = DATA_STATUS;
		this.status = null;

		this.data = ServiceSpecification.buildInitialData();

		this.create = create;

		function create() {
			vm.status = vm.STATUS.PENDING;
			this.data.specCharacteristic = this.characteristics
	
			ServiceSpecification.createServiceSpecification(this.data).then(() => {
				vm.status = vm.STATUS.LOADED;
				$state.go('stock.service.update', {
					serviceSpecId: vm.data.serviceSpecId
				});
				$rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
					resource: 'service specification',
					name: vm.data.name
				});
			}).catch((response) => {
				vm.status = vm.STATUS.ERROR;
				const defaultMessage =
					'There was an unexpected error that prevented the system from creating a new IDP';
				const error = Utils.parseError(response, defaultMessage);

				$rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
					error: error
				});
			});
		}

		charCtl();
	}

	function ServiceSpecificationUpdateController($scope, $state, $rootScope, LIFECYCLE_STATUS, DATA_STATUS, ServiceSpecification, Utils, EVENTS) {
		this.STATUS = DATA_STATUS
        this.status = DATA_STATUS.LOADING

        this.updateStatus = DATA_STATUS.LOADED

        this.data = {}
        this.item = {}

        ServiceSpecification.getServiceSpecficiation($state.params.serviceId).then((spec) => {
            this.data = angular.copy(spec);

            this.item = spec
            this.status = this.STATUS.LOADED
        }).catch((response) => {
            this.errorMessage = Utils.parseError(response, 'It was impossible to load the service specification')
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
            ServiceSpecification.udpateServiceSpecification(this.data.id, dataUpdated).then((updated) => {
                this.updateStatus = DATA_STATUS.LOADED
                $state.go(
                    'stock.service.update',
                    {
                        serviceId: updated.id
                    },
                    {
                        reload: true
                    }
                );
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
                    resource: 'service spec',
                    name: updated.name
                });
            }).catch((response) => {
                this.updateStatus = DATA_STATUS.LOADED
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to update the service spec.')
                });
            });
		}
	}

})();
