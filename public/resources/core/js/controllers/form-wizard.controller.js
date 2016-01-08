/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .controller('FormWizardCtrl', FormWizardController);

    function FormWizardController() {
        /* jshint validthis: true */
        var vm = this;

        vm.hasError = hasError;
        vm.nextStep = nextStep;
        vm.isDisabled = isDisabled;

        function isDisabled(index, step) {

            if (vm.stepIndex == null && index == 0) {
                nextStep(index, step);
            }

            return vm.stepIndex != index && (!step.form || !step.form.$valid || !step.visited);
        }

        function nextStep(index, step) {
            vm.stepIndex = index;

            if (step) {
                step.visited = true;
            }
        }

        function hasError(field) {
            return field && (field.$invalid && (field.$dirty || field.$touched));
        }
    }

})();
