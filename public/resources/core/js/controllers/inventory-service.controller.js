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

    const LOADING = 'LOADING';
    const LOADED = 'LOADED';
    const ERROR = 'ERROR';

    angular
        .module('app')
        .controller('ServiceInventorySearchCtrl', [
            '$scope',
            '$state',
            '$rootScope',
            'EVENTS',
            'ServiceInventory',
            'SERVICE_INVENTORY_STATUS',
            'Utils',
            ServiceInventorySearchController
        ])
        .controller('ServiceInventoryDetailsCtrl', [
            '$rootScope',
            '$scope',
            '$state',
            'ServiceInventory',
            'Utils',
            'EVENTS',
            '$interval',
            '$window',
            'LOGGED_USER',
            ServiceInventoryDetailController
        ]);

    function ServiceInventorySearchController($scope, $state, $rootScope, EVENTS, ServiceInventory, SERVICE_INVENTORY_STATUS, Utils) {

        this.list = []
        this.offset = -1;

        this.showFilters = () => {
            $rootScope.$broadcast(EVENTS.FILTERS_OPENED, SERVICE_INVENTORY_STATUS);
        };

        this.getElementsLength = () => {
            //var params = {};
            //angular.copy($state.params, params);
            //return InventoryProduct.count(params);
            return Promise.resolve(10)
        }

        this.inventorySearch = () => {
            this.list.loadStatus = LOADING;

            if (this.offset >= 0) {
                const params = {};
                angular.copy($state.params, params);

                params.offset = this.offset;
                params.limit = this.limit;

                ServiceInventory.search(params).then((productList) => {
                    this.list.loadStatus = LOADED;
                    angular.copy(productList, this.list);
                }).catch((response) => {
                    this.error = Utils.parseError(response, 'It was impossible to load the list of products');
                    this.list.loadStatus = ERROR;
                })
            }
        }

        $scope.$watch(() => {
            return this.offset;
        }, this.inventorySearch.bind(this));
    }

    function ServiceInventoryDetailController($rootScope, $scope, $state, ServiceInventory, Utils, EVENTS, $interval, $window, LOGGED_USER) {
        this.item = null

        this.isUrl = (value) => {
            return value.startsWith("http")
        }

        ServiceInventory.detail($state.params.serviceId).then((service) => {
            this.item = service
            this.item.loadStatus = LOADED;
        }).catch(() => {
            this.error = Utils.parseError(response, 'It was impossible to load service details');
            this.item.loadStatus = ERROR;
        })
    }
})();