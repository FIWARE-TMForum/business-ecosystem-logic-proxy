/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */


(function () {

    'use strict';

    angular
        .module('app')
        .controller('ContactMediumCreateCtrl', ContactMediumCreateController)
        .controller('ContactMediumUpdateCtrl', ContactMediumUpdateController);

    function ContactMediumCreateController($scope, $rootScope, $controller, COUNTRIES, Individual) {
        /* jshint validthis: true */
        var vm = this;

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        vm.CONTACT_MEDIUM = Individual.TYPES.CONTACT_MEDIUM;
        vm.COUNTRIES = COUNTRIES;

        vm.data = new Individual.ContactMedium();
        vm.data.resetMedium();

        vm.create = create;

        function create(form, $parentController) {
            $parentController.createContactMedium(vm.data).then(function () {
                vm.data = new Individual.ContactMedium();
                vm.data.resetMedium();
                vm.resetForm(form);
            });
        }
    }

    function ContactMediumUpdateController($element, $scope, $rootScope, $controller, COUNTRIES, Individual) {
        /* jshint validthis: true */
        var vm = this;
        var _index;

        angular.extend(vm, $controller('FormMixinCtrl', {$scope: $scope}));

        vm.CONTACT_MEDIUM = Individual.TYPES.CONTACT_MEDIUM;
        vm.COUNTRIES = COUNTRIES;

        vm.update = update;

        $scope.$on(Individual.EVENTS.CONTACT_MEDIUM_UPDATE, function (event, index, contactMedium) {
            vm.data = angular.copy(contactMedium);
            _index = index;
            $element.modal('show');
        });

        function update(form) {
            $rootScope.$broadcast(Individual.EVENTS.CONTACT_MEDIUM_UPDATED, _index, vm.data);
            vm.resetForm(form);
        }
    }

})();
