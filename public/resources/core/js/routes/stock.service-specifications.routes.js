/* Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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


(function() {
	'use strict';

	angular.module('app').config(['$stateProvider', ServiceSpecificationRouteConfig]);

	function ServiceSpecificationRouteConfig($stateProvider) {
		$stateProvider
			.state('stock.service', {
				url: '/servicespecification?status&body&sort',
				params: {
					owner: true,
					status: 'Active,Launched'
				},
				data: {
					filters: ['status', 'sort']
				},
				templateUrl: 'stock/service-specification/search',
				controller: 'ServiceSpecificationListCtrl as searchVM'
			})
			.state('stock.service.create', {
				url: '/create',
				templateUrl: 'stock/service-specification/create',
				controller: 'ServiceSpecificationCreateCtrl as createVM'
			})
			.state('stock.service.update', {
				url: '/:serviceId',
				templateUrl: 'stock/service-specification/update',
				controller: 'ServiceSpecificationUpdateCtrl as updateVM'
			})
			.state('stock.service.update.characteristic', {
                url: '/characteristic',
                templateUrl: 'stock/service-specification/update/characteristic'
            });
	}
})();
