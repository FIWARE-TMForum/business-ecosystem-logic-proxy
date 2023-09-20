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
(function() {
    'use strict';

    angular
        .module('app')
        .controller('RSTransSearchCtrl', [
            '$state',
            '$rootScope',
            '$scope',
            'DATA_STATUS',
            'RSS',
            'Utils',
            RSTransSearchController
        ]);

    function RSTransSearchController($state, $rootScope, $scope, DATA_STATUS, RSS, Utils) {
        var vm = this;

        vm.$params = $state.params;
        vm.state = $state;
        vm.offset = -1;
        vm.limit = -1;
        vm.list = [];
        vm.list.status = DATA_STATUS.LOADING;

        var sharingModels = [];

        vm.getTxType = getTxType;
        vm.createReport = createReport;
        vm.getElementsLength = getElementsLength;

        function getElementsLength() {
            return RSS.countTransactions();
        }

        function createReport() {
            RSS.searchProductClasses().then(
                function(classes) {
                    $rootScope.$broadcast(RSS.EVENTS.REPORT_CREATE, classes.productClasses);
                },
                function() {
                    vm.error = Utils.parseError(response, 'It was impossible to load the list of product classes');
                    vm.list.status = DATA_STATUS.ERROR;
                }
            );
        }

        function getTxType(txType) {
            var types = {
                C: 'Charge',
                R: 'Refund'
            };
            return types[txType];
        }

        function updateRSTrans() {
            vm.list.status = DATA_STATUS.LOADING;

            if (vm.offset >= 0) {
                var params = {
                    offset: vm.offset,
                    size: vm.limit
                };

                RSS.searchTransactions(params).then(
                    function(transactions) {
                        vm.list = angular.copy(transactions);
                        vm.list.status = DATA_STATUS.LOADED;
                    },
                    function() {
                        vm.error = Utils.parseError(response, 'It was impossible to load the list of transactions');
                        vm.list.status = DATA_STATUS.ERROR;
                    }
                );
            }
        }

        $scope.$watch(function() {
            return vm.offset;
        }, updateRSTrans);
    }
})();
