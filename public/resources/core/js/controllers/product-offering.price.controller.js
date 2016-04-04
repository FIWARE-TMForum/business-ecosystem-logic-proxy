/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .controller('PricePlanUpdateCtrl', PricePlanUpdateController);

    function PricePlanUpdateController($element, $scope, $rootScope, $controller, Offering) {
        /* jshint validthis: true */
        var vm = this;

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        vm.CHARGE_PERIODS = Offering.TYPES.CHARGE_PERIOD;
        vm.CURRENCY_CODES = Offering.TYPES.CURRENCY_CODE;
        vm.PRICES = Offering.TYPES.PRICE;

        vm.update = update;

        $scope.$on(Offering.EVENTS.PRICEPLAN_UPDATE, function (event, pricePlan) {
            vm.item = pricePlan;
            vm.data = angular.copy(pricePlan);
            $element.modal('show');
        });

        function update() {
            $rootScope.$broadcast(Offering.EVENTS.PRICEPLAN_UPDATED, angular.merge(vm.item, vm.data));
        }
    }

})();
