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
            'PROMISE_STATUS',
            'SHOW_LOCAL_LOGIN',
            'SHOW_VC_LOGIN',
            'IdpsService',
            LoginController
        ]);

    function LoginController($scope, $element, $window, EVENTS, PROMISE_STATUS, SHOW_LOCAL_LOGIN, SHOW_VC_LOGIN,
                             IdpsService) {
        var vm = this;

        vm.searchInput = '';
        vm.idpId = null;
        vm.showLocal = SHOW_LOCAL_LOGIN;
        vm.showVC = SHOW_VC_LOGIN;
        vm.handleEnterKeyUp = handleEnterKeyUp;
        vm.launchSearch = launchSearch;
        vm.setIdp = setIdp;
        vm.login = login;
        vm.isValid = isValid;
        vm.load = load;

        vm.STATUS = PROMISE_STATUS;
        vm.status = this.STATUS.PENDING;
        vm.idps = [];

        function load(search) {
            vm.status = vm.STATUS.PENDING;
            IdpsService.getIdps(search).then(
                (items) => {
                    vm.idps = items;
                    vm.status = vm.STATUS.RESOLVED;
                },
                (err) => {
                    vm.errorMessage = err;
                    vm.status = vm.STATUS.REJECTED;
                }
            );
        }

        function handleEnterKeyUp(event) {
            if (event.keyCode == 13) {
                load(vm.searchInput);
            }
        }

        function launchSearch() {
            load(vm.searchInput);
        }

        function setIdp(index) {
            if (index === -1) {
                vm.idpId = 'local';
            } else if (index === -2) {
                vm.idpId = 'vc';
            } else {
                vm.idpId = vm.idps[index].idpId;
            }
        }

        function login(context) {
            let id = vm.idpId;

            if (id == 'local') {
                id = '';
            }
            $window.open(context + id, "_top");
        }

        function isValid() {
            return vm.idpId != null;
        }

        $scope.$on(EVENTS.SIGN_IN, (event) => {
            $element.modal('show');
            vm.load();
        });
    }
})();