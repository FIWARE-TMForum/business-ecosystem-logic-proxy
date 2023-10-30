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

    angular.module('app').config(['$stateProvider', CatalogueRouteConfig]);

    function CatalogueRouteConfig($stateProvider) {
        $stateProvider
            .state('stock.resource', {
                url: '/resource?status&body&sort',
                params: {
                    owner: true,
                    status: 'Active,Launched'
                },
                data: {
                    filters: ['status', 'sort']
                },
                templateUrl: 'stock/resource-spec/search',
                controller: 'ResourceSpecSearchCtrl as searchVM'
            })
            .state('stock.resource.create', {
                url: '/create',
                templateUrl: 'stock/resource-spec/create',
                controller: 'ResourceSpecCreateCtrl as createVM'
            })
            .state('stock.resource.update', {
                url: '/:resourceId',
                templateUrl: 'stock/resource-spec/update',
                controller: 'ResourceSpecUpdateCtrl as updateVM'
            })
    }
})();
