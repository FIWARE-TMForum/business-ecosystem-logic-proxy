/**
 *
 */

angular.module('app')
    .controller('FlashMessageListCtrl', function ($scope, $rootScope, $sce, $interpolate, $timeout, EVENTS) {

        $scope.resetAlert = function resetAlert() {
            $scope.alert = {};
            $scope.hidden = true;
        };

        $scope.showAlert = function showAlert(state, message, delay) {
            $scope.alert[state] = true;
            $scope.alert.message = message;
            $scope.hidden = false;
            $timeout(function () { $scope.resetAlert(); }, delay);
        };

        $scope.$on(EVENTS.MESSAGE_SHOW, function (event, state, message, context) {
            $scope.showAlert(state, $sce.trustAsHtml($interpolate(message)(context || {})), 2500)
        });

        $scope.resetAlert();
    });
