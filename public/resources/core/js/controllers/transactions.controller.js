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
        .controller('RSTransSearchCtrl', RSTransSearchController);

    function RSTransSearchController($state, $rootScope, $scope, DATA_STATUS, RSS, Utils, Party, User) {
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

	$scope.$on(Party.EVENTS.USER_SESSION_SWITCHED, function (event, message, obj) {
	    if (Party.isOrganization() || User.loggedUser.currentUser.id === User.loggedUser.id){
		RSTransSearch();
	    }
	});

	function RSTransSearch() {
	    RSS.searchTransactions().then(function(transactions) {
		vm.list = angular.copy(transactions);
		vm.list.status = DATA_STATUS.LOADED;
		filterProductClass(transactions);
            }, function(response) {
		vm.error = Utils.parseError(response, 'It was impossible to load the list of transactions');
		vm.list.status = DATA_STATUS.ERROR;
            });
	};

	RSTransSearch();

        function filterProductClass(transactions) {
            var set = {};

            transactions.forEach(function (transaction) {
                set[transaction.productClass] = {};
            });

            sharingModels = Object.keys(set);
        }
    }

})();
