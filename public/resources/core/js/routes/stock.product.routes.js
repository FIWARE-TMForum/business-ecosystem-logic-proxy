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
        .config(['$stateProvider', ProductRouteConfig]);

    function ProductRouteConfig($stateProvider) {

        $stateProvider
            .state('stock.product', {
                url: '/product?status&type&body&sort',
                params: {
                    owner: true,
                    flow: 1,
                    status: 'Active,Launched'
                },
                data: {
                    filters: ['status', 'type', 'sort']
                },
                templateUrl: 'stock/product/search',
                controller: 'ProductSearchCtrl as searchVM'
            })
            .state('stock.product.create', {
                url: '/create',
                templateUrl: 'stock/product/create',
                controller: 'ProductCreateCtrl as createVM'
            })
            .state('stock.product.update', {
                url: '/:productId',
                templateUrl: 'stock/product/update',
                controller: 'ProductUpdateCtrl as updateVM'
            })
            .state('stock.product.update.bundled', {
                url: '/bundled',
                params: {
                    flow: 1
                },
                templateUrl: 'stock/product/update/bundled'
            })
            .state('stock.product.update.attachment', {
                url: '/attachment',
                templateUrl: 'stock/product/update/attachment'
            })
            .state('stock.product.update.relationship', {
                url: '/relationship',
                templateUrl: 'stock/product/update/relationship'
            })
            .state('stock.product.update.characteristic', {
                url: '/characteristic',
                templateUrl: 'stock/product/update/characteristic'
            });
    }

})();
