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
 */
(function () {

    'use strict';

    angular
        .module('app')
        .controller('FormMixinCtrl', FormMixinController)
        .controller('FormWizardCtrl', FormWizardController);

    function FormMixinController() {
        /* jshint validthis: true */
        var vm = this;

        vm.hasFieldError = hasFieldError;
        vm.resetForm = resetForm;

        function hasFieldError(field) {
            return field && (field.$invalid && (field.$dirty || field.$touched));
        }

        function resetForm(form) {
            form.$setPristine();
            form.$setUntouched();
        }
    }

    function FormWizardController() {
        /* jshint validthis: true */
        var vm = this;

        vm.hasError = hasError;
        vm.nextStep = nextStep;
        vm.isDisabled = isDisabled;
        vm.resetForm = resetForm;
        vm.resetFormField = resetFormField;

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

        function resetForm(form) {
            form.$setPristine();
            form.$setUntouched();
            return true;
        }

        function resetFormField(formField) {
            formField.$setPristine();
            formField.$setUntouched();
            return true;
        }
    }

})();
