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

    function RSTransSearchController($state, DATA_STATUS, RSS, Utils) {
        var vm = this;

        vm.state = $state;
        vm.getTxType = getTxType;

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
        }, function() {
            vm.error = Utils.parseError(response, 'It was impossible to load the list of transactions');
            vm.list.status = DATA_STATUS.ERROR;
        });
    }

})();