const { response } = require("express");

(function() {
	'use strict';

	var LOADING = 'LOADING';
	var LOADED = 'LOADED';
	var ERROR = 'ERROR';

	angular
		.module('app')
		.controller('ServiceSpecificationListCtrl', ['$scope', 'ServiceSpecification', 'Utils', ServiceSpecificationListController])
		.controller('ServiceSpecificationCreateCtrl', [
			'$state', '$rootScope', 'PROMISE_STATUS', 'EVENTS', 'ServiceSpecification', 'Utils', ServiceSpecificationCreateController])
		.controller('ServiceSpecificationUpdateCtrl', [
			'$state', '$rootScope', 'PROMISE_STATUS', 'EVENTS', 'ServiceSpecification', 'Utils', ServiceSpecificationUpdateController])

	function ServiceSpecificationListController($scope, ServiceSpecification, Utils) {
		var vm = this;
		vm.list = [];
		vm.offset = -1;
		vm.size = -1;
		vm.sidebarInput = '';
		vm.updateList = updateList;

		function updateList() {
			vm.list.status = LOADING;

			if (vm.offset >= 0) {
				var page = {
					offset: vm.offset,
					size: vm.size,
					body: vm.sidebarInput
				};
				ServiceSpecification.getServiceSpecifications(page).then(
					(itemList) => {
						angular.copy(itemList, vm.list);
						vm.list.status = LOADED;
					},
					(response) => {
						vm.error = Utils.parseError(response, 'It was impossible to load the list of service specifications');
						vm.list.status = ERROR;
					}
				);
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
