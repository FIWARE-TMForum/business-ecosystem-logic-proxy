/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .controller('PriceplanUpdateCtrl', PriceplanUpdateController);

    function PriceplanUpdateController($element, $scope, $rootScope, $controller, Offering) {
        /* jshint validthis: true */
        var vm = this;

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        $scope.CHARGE_PERIODS = Offering.TYPES.CHARGE_PERIOD;
        $scope.CURRENCY_CODES = Offering.TYPES.CURRENCY_CODE;
        $scope.PRICES = Offering.TYPES.PRICE;

        vm.update = update;

        $scope.$on(Offering.EVENTS.PRICEPLAN_UPDATE, function (event, priceplan) {
            vm.item = priceplan;
            vm.data = angular.copy(priceplan);
            $element.modal('show');
        });

        function update() {
            $rootScope.$broadcast(Offering.EVENTS.PRICEPLAN_UPDATED, angular.merge(vm.item, vm.data));
        }
    }

})();
