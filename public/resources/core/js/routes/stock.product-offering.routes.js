/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
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
        .config(OfferingRouteConfig);

    function OfferingRouteConfig($stateProvider) {

        $stateProvider
            .state('stock.offering', {
                url: '/offering?status&type',
                params: {
                    owner: true,
                    flow: 1,
                    status: 'Active,Launched'
                },
                data: {
                    filters: ['status', 'type']
                },
                templateUrl: 'stock/product-offering/search',
                controller: 'OfferingSearchCtrl as searchVM'
            })
            .state('stock.offering.create', {
                url: '/create',
                templateUrl: 'stock/product-offering/create',
                controller: 'OfferingCreateCtrl as createVM'
            })
            .state('stock.offering.update', {
                url: '/:offeringId',
                templateUrl: 'stock/product-offering/update',
                controller: 'OfferingUpdateCtrl as updateVM'
            })
            .state('stock.offering.update.bundled', {
                url: '/bundled',
                params: {
                    flow: 1
                },
                templateUrl: 'stock/product-offering/update/bundled'
            })
            .state('stock.offering.update.priceplan', {
                url: '/priceplan',
                templateUrl: 'stock/product-offering/update/priceplan'
            })
            .state('stock.offering.update.category', {
                url: '/category',
                templateUrl: 'stock/product-offering/update/category'
            });
    }

})();
