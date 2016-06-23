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
 */
(function () {

    'use strict';

    angular
        .module('app')
        .controller('SearchFilterCtrl', SearchFilterController);

    function SearchFilterController($state, $scope, $element, EVENTS) {
        /* jshint validthis: true */
        var vm = this;
        var statusStates = [];

        vm.exists = exists;
        vm.checkboxChecked = checkboxChecked;
        vm.getStatusStates = getStatusStates;
        vm.toggleCheckbox = toggleCheckbox;

        $element.on('hidden.bs.modal', function (event) {
            $state.go($state.current.name, vm.filters);
        });

        $scope.$on(EVENTS.FILTERS_OPENED, function (event, states) {
            vm.filters = angular.copy($state.params);
            statusStates = states;
            $element.modal('show');
        });

        function getStatusStates() {
            return statusStates;
        }

        function toggleCheckbox(name, value) {
            var items = convertToArray(name);
            var index = items.indexOf(value);

            if (index !== -1) {
                items.splice(index, 1);
            } else {
                items.push(value);
            }

            vm.filters[name] = items.join();
        }

        function checkboxChecked(name, value) {
            return exists(name) && (convertToArray(name).indexOf(value) !== -1);
        }

        function convertToArray(name) {
            return vm.filters[name] ? vm.filters[name].split(',') : [];
        }

        function exists(name) {
            return ($state.current.data && vm.filters) && ($state.current.data.filters.indexOf(name) !== -1);
        }
    }

})();
