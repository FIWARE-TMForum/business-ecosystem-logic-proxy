/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .controller('RSTransSearchCtrl', RSTransSearchController);

    function RSTransSearchController($state, $rootScope, DATA_STATUS, RSS, Utils) {
        var vm = this;

        vm.$params = $state.params;
        vm.state = $state;
        vm.getTxType = getTxType;
        vm.list = [];
        vm.list.status = DATA_STATUS.LOADING;

        var sharingModels = [];

        vm.createReport = createReport;

        function createReport() {
            $rootScope.$broadcast(RSS.EVENTS.REPORT_CREATE, sharingModels);
        }

        function getTxType(txType) {
            var types = {
                'C': 'Charge',
                'R': 'Refund'
            };
            return types[txType];
        }

        RSS.searchTransactions().then(function(transactions) {
            vm.list = angular.copy(transactions);
            vm.list.status = DATA_STATUS.LOADED;
            filterProductClass(transactions);
        }, function() {
            vm.error = Utils.parseError(response, 'It was impossible to load the list of transactions');
            vm.list.status = DATA_STATUS.ERROR;
        });

        function filterProductClass(transactions) {
            var set = {};

            transactions.forEach(function (transaction) {
                set[transaction.productClass] = {};
            });

            sharingModels = Object.keys(set);
        }
    }

})();