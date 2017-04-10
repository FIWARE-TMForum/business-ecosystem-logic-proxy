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
        .config(CatalogueRouteConfig);

    function CatalogueRouteConfig($stateProvider) {

        $stateProvider
            .state('stock.catalogue', {
                url: '/catalogue?status&role&body',
                params: {
                    owner: true,
                    status: 'Active,Launched'
                },
                data: {
                    filters: ['status', 'role']
                },
                templateUrl: 'stock/product-catalogue/search',
                controller: 'CatalogueSearchCtrl as searchVM'
            })
            .state('stock.catalogue.create', {
                url: '/create',
                templateUrl: 'stock/product-catalogue/create',
                controller: 'CatalogueCreateCtrl as createVM'
            })
            .state('stock.catalogue.update', {
                url: '/:catalogueId',
                templateUrl: 'stock/product-catalogue/update',
                controller: 'CatalogueUpdateCtrl as updateVM'
            })
            .state('stock.catalogue.update.party', {
                url: '/party',
                templateUrl: 'stock/product-catalogue/update/party'
            })
            .state('stock.catalogue.update.offering', {
                url: '/offering?categoryId',
                data: {
                    filters: ['status']
                },
                templateUrl: 'stock/product-catalogue/update/offering',
                controller: 'OfferingSearchCtrl as searchVM'
            });
    }

})();
