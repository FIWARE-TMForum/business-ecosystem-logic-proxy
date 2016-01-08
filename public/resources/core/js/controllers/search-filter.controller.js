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

        vm.exists = exists;
        vm.checkboxChecked = checkboxChecked;
        vm.toggleCheckbox = toggleCheckbox;

        $element.on('hidden.bs.modal', function (event) {
            $state.go($state.current.name, vm.filters);
        });

        $scope.$on(EVENTS.FILTERS_OPENED, function (event) {
            vm.filters = angular.copy($state.params);
            $element.modal('show');
        });

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
