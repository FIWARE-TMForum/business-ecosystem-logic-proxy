/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */


(function () {

    'use strict';

    angular
        .module('app')
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

})();
