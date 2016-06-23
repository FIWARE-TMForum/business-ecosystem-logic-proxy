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
        .controller('RSReportCreateCtrl', RSReportCreateController)
        .controller('RSReportSearchCtrl', RSReportSearchController);

    function RSReportSearchController(DATA_STATUS, RSS, Utils) {
        var vm = this;

        vm.list = [];
        vm.list.status = DATA_STATUS.LOADING;

        RSS.searchReports().then(function(reports) {
            vm.list = angular.copy(reports);
            vm.list.status = DATA_STATUS.LOADED;
        }, function (response) {
            vm.error = Utils.parseError(response, 'Unexpected error trying to retrieve the reports.');
            vm.list.status = DATA_STATUS.ERROR;
        });
    }

    function RSReportCreateController($state, $scope, $rootScope, $element, RSS, EVENTS, Utils) {
        var vm = this;

        vm.data = {
            productClass: null
        };

        vm.setProductClass = setProductClass;
        vm.create = create;

        $scope.$on(RSS.EVENTS.REPORT_CREATE, function (event, sharingModels) {
            vm.sharingModels = sharingModels;
            $element.modal('show');
        });

        function setProductClass(productClass) {
            vm.data.productClass = vm.data.productClass !== productClass ? productClass : null;
        }

        function create() {
            RSS.createReport(vm.data).then(function () {
                $state.go('rss.reports');
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'success', {
                    message: 'This operation could take up to several minutes.'
                });
            }, function (response) {
                $rootScope.$broadcast(EVENTS.MESSAGE_ADDED, 'error', {
                    error: Utils.parseError(response, 'Unexpected error trying to create the report.')
                });
            });
            $rootScope.$broadcast(RSS.EVENTS.REPORT_CREATED, vm.data);
            vm.data = {
                productClass: null
            };
        }
    }

})();
