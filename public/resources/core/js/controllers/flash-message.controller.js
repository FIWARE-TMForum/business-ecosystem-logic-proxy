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
            created: 'The {{ resource }} <strong>{{ name }}</strong> was created successfully.',
            updated: 'The {{ resource }} <strong>{{ name }}</strong> was updated successfully.',
            success: '{{ message }}',
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
            case 'created':
            case 'updated':
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
