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
			'$state', '$rootScope', 'PROMISE_STATUS', 'EVENTS', 'ServiceSpecification', 'Utils', ServiceSpecificationUpdateController])

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

	function ServiceSpecificationUpdateController($state, $rootScope, PROMISE_STATUS, DATA_STATUS, EVENTS, ServiceSpecification, Utils) {
		var vm = this;
		this.STATUS = PROMISE_STATUS;
		this.DATA_STATUS = DATA_STATUS;

		this.status = this.STATUS.PENDING;
		this.dataStatus = this.DATA_STATUS.LOADED;
		this.data = {};

		ServiceSpecification.getServiceSpecification($state.params.serviceSpecId).then(
			(serviceSpecification) => {
				this.status = this.STATUS.REJECTED;
				this.data = serviceSpecification;
			},
			(response) => {
				this.status = this.STATUS.RESOLVED;
				this.errorMessage = Utils.parseError(response, 'The requested Service Specification could not be retrieved');
			});

		this.update = update;

		function update() {
			vm.dataStatus = vm.DATA_STATUS.LOADING;
			ServiceSpecification.updateServiceSpecification(vm.data.serviceSpecId, vm.data).then(
				() => {
					vm.dataStatus = vm.DATA_STATUS.LOADED;
					$rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'updated', {
						resource: 'IDP',
						name: vm.data.serviceSpecId
					});
				},
				(response) => {
					vm.dataStatus = vm.DATA_STATUS.ERROR;
					const defaultMessage =
						'There was an unexpected error that prevented the system from updated a new service specification';
					const error = Utils.parseError(response, defaultMessage);

					$rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
						error: error
					});
				});
		}
	}

})();
