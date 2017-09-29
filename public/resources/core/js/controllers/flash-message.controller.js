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
        .controller('FlashMessageListCtrl', FlashMessageListController);

    function FlashMessageListController($scope, $rootScope, $sce, $interpolate, $timeout, EVENTS) {
        /* jshint validthis: true */
        var vm = this;
        var messages = {
            created: 'The {{ resource }} <strong>{{ name }}</strong> was created.',
            updated: 'The {{ resource }} <strong>{{ name }}</strong> was updated.',
            upgraded: 'The {{ resource }} <strong>{{ name }}</strong> was upgraded',
            success: '{{ message }}',
            info: '{{ message }}',
            error: '{{ error }}'
        };

        vm.list = [];

        vm.hideAlert = hideAlert;

        $scope.$on(EVENTS.MESSAGE_ADDED, function (event, action, context) {
            showAlert(action, interpolateMessage(action, context));
        });

        function interpolateMessage(action, context) {
            return $sce.trustAsHtml($interpolate(messages[action])(context || {}));
        }

        function showAlert(action, message) {
            var length = vm.list.push({
                state: getState(action),
                message: message
            });

            vm.list[length - 1].hideTrigger = $timeout(function () {
                hideAlert(0);
            }, 2500);
        }

        function getState(action) {
            var state = 'info';

            switch (action) {
                case 'info':
                    state = 'info';
                    break;
                case 'created':
                case 'updated':
                case 'upgraded':
                case 'success':
                    state = 'success';
                    break;
                case 'error':
                    state = 'danger';
                    break;
            }

            return state;
        }

        function hideAlert(index) {
            var item = vm.list.splice(index, 1)[0];
            $timeout.cancel(item.hideTrigger);
        }
    }

})();
