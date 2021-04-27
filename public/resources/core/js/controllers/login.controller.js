/* Copyright (c) 2021 Future Internet Consulting and Development Solutions S.L.
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

    angular
        .module('app')
        .controller('LoginCtrl', [
            '$scope',
            '$element',
            '$window',
            'EVENTS',
            LoginController
        ]);

    function LoginController($scope, $element, $window, EVENTS) {
        var vm = this;

        vm.searchInput = '';
        vm.idpId = null;
        vm.handleEnterKeyUp = handleEnterKeyUp;
        vm.launchSearch = launchSearch;
        vm.setIdp = setIdp;
        vm.login = login;
        vm.isValid = isValid;

        function handleEnterKeyUp(event) {}

        function launchSearch() {}

        function setIdp(idp) {
            vm.idpId = idp;
        }

        function login(context) {
            $window.open(context + vm.idpId, "_top");
        }

        function isValid() {
            return vm.idpId != null;
        }

        $scope.$on(EVENTS.SIGN_IN, (event) => {
            $element.modal('show');
        });
    }
})();