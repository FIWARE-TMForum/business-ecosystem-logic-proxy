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
			'PROMISE_STATUS',
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

	function ServiceSpecificationCreateController($state, $rootScope, PROMISE_STATUS, EVENTS, ServiceSpecification, Utils) {
		var vm = this;
		this.STATUS = PROMISE_STATUS;
		this.status = null;

		this.data = {};

		this.create = create;

		function create() {
			vm.status = vm.STATUS.PENDING;
			ServiceSpecification.createServiceSpecification(vm.data).then(
				() => {
					vm.status = vm.STATUS.RESOLVED;
					$state.go('stock.serviceSpecification.update', {
						serviceSpecId: vm.data.serviceSpecId
					});
					$rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'created', {
						resource: 'serviceSpecification',
						name: vm.data.name
					});
				},
				(response) => {
					vm.status = vm.STATUS.REJECTED;
					const defaultMessage =
						'There was an unexpected error that prevented the system from creating a new IDP';
					const error = Utils.parseError(response, defaultMessage);

					$rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
						error: error
					});
				}
			);
		}
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
