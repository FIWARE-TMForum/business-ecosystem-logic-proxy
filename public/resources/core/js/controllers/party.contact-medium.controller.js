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
        .controller('ContactMediumCreateCtrl', ContactMediumCreateController)
        .controller('ContactMediumUpdateCtrl', ContactMediumUpdateController);

    function ContactMediumCreateController($scope, $rootScope, $controller, COUNTRIES, partyService) {
        /* jshint validthis: true */
        var vm = this;

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        vm.CONTACT_MEDIUM = partyService.TYPES.CONTACT_MEDIUM;
        vm.COUNTRIES = COUNTRIES;

        vm.data = new partyService.ContactMedium();
        vm.data.resetMedium();

        vm.create = create;

        function create(form, $parentController) {
            $parentController.createContactMedium(vm.data).then(function () {
                vm.data = new partyService.ContactMedium();
                vm.data.resetMedium();
                vm.resetForm(form);
            });
        }
    }

    function ContactMediumUpdateController($element, $scope, $rootScope, $controller, COUNTRIES, partyService) {
        /* jshint validthis: true */
        var vm = this;
        var _index;

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        vm.CONTACT_MEDIUM = partyService.TYPES.CONTACT_MEDIUM;
        vm.COUNTRIES = COUNTRIES;

        vm.update = update;

        $scope.$on(partyService.EVENTS.CONTACT_MEDIUM_UPDATE, function (event, index, contactMedium) {
            vm.data = angular.copy(contactMedium);
            _index = index;
            $element.modal('show');
        });

        function update(form) {
            $rootScope.$broadcast(partyService.EVENTS.CONTACT_MEDIUM_UPDATED, _index, vm.data);
            vm.resetForm(form);
        }
    }

})();
