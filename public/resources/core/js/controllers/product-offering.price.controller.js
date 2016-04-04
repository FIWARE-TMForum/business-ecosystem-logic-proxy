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
        var _index, _pricePlan;

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        vm.CHARGE_PERIODS = Offering.TYPES.CHARGE_PERIOD;
        vm.CURRENCY_CODES = Offering.TYPES.CURRENCY_CODE;
        vm.PRICES = Offering.TYPES.PRICE;

        vm.update = update;

        $scope.$on(Offering.EVENTS.PRICEPLAN_UPDATE, function (event, index, pricePlan) {
            _index = index;
            _pricePlan = pricePlan;
            vm.data = angular.copy(pricePlan);
            $element.modal('show');
        });

        function update() {
            $rootScope.$broadcast(Offering.EVENTS.PRICEPLAN_UPDATED, _index, vm.data);
        }
    }

})();
