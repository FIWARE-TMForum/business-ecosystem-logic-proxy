(function() {
	'use strict';

	angular.module('app').config(['$stateProvider', ServiceSpecificationRouteConfig]);

	function ServiceSpecificationRouteConfig($stateProvider) {
		$stateProvider
			.state('stock.serviceSpecification', {
				url: '/servicespecification?status&role&body&sort',
				params: {
					owner: true,
					status: 'Active,Launched'
				},
				data: {
					filters: ['status', 'role', 'sort']
				},
				templateUrl: 'stock/service-specification/search',
				controller: 'ServiceSpecificationListCtrl as searchVM'
			})
			.state('stock.serviceSpecification.create', {
				url: '/create',
				templateUrl: 'stock/service-specification/create',
				controller: 'ServiceSpecificationCreationCtrl'
			})
			.state('stock.serviceSpecficiation.update', {
				url: '/update',
				templateUrl: 'stock/service-specification/update',
				controller: 'ServiceSpecificationUpdateCtrl'
			});
	}
})();
