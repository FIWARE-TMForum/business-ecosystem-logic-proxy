/**
 *
 */

angular.module('app.controllers')
    .controller('MessageListCtrl', ['$scope', '$rootScope', '$sce', '$interpolate', '$timeout', 'EVENTS', function ($scope, $rootScope, $sce, $interpolate, $timeout, EVENTS) {

        $scope.resetAlert = function resetAlert() {
            $scope.$alert = {};
            $scope.hidden = true;
        };

        $scope.showAlert = function showAlert(status, message, delay) {
            $scope.$alert[status] = true;
            $scope.$alert.message = message;
            $scope.hidden = false;
            $timeout(function () { $scope.resetAlert(); }, delay);
        };

        $scope.$on(EVENTS.MESSAGE_SHOW, function ($event, status, message, context) {
            $scope.showAlert(status, $sce.trustAsHtml($interpolate(message)(context || {})), 2500)
        });

        $scope.resetAlert();
    }]);
