/* Copyright (c) 2015 - 2017 CoNWeT Lab., Universidad Politécnica de Madrid
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
(function () {

    'use strict';

    angular
        .module('app')
        .config(['$stateProvider', StockRouteConfig])
        .controller('RouteStockCtl', ['$state', StockController]);

    function StockRouteConfig($stateProvider) {

        $stateProvider
            .state('stock', {
                url: '/stock',
                data: {
                    title: 'My Stock',
                    loggingRequired: true
                },
                views: {
                    'sidebar-content': {
                        templateUrl: 'stock/sidebar',
                        controller: 'RouteStockCtl'
                    },
                    'content': {
                        template: '<ui-view>'
                    }
                }
            });
    }

    function StockController($state) {

        if ($state.is('stock')) {
            $state.go('stock.catalogue');
        }
    }

})();
