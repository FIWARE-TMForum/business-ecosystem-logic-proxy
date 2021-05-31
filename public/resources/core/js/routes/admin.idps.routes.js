/* Copyright (c) 2021 Future Internet Consulting and Development Solutions S.L.
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
 */
 (function() {
    'use strict';

    angular.module('app').config(['$stateProvider', RouteConfig]);

    function RouteConfig($stateProvider) {
        $stateProvider
            .state('admin.idps', {
                url: '/idps',
                params: {
                    admin: true
                },
                views: {
                    'admin-content': {
                        templateUrl: 'admin/idps/search',
                        controller: 'IdpsSearchCtrl as searchVM'
                    }
                }
            })
            .state('admin.idps.create', {
                url: '/idps/create',
                templateUrl: 'admin/idps/create',
                controller: 'IdpsCreateCtrl as createVM'
            })
            .state('admin.idps.update', {
                url: '/idps/:idpId',
                templateUrl: 'admin/idps/update',
                controller: 'IdpsUpdateCtrl as updateVM'
            });
    }
})();
