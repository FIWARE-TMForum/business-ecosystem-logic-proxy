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
