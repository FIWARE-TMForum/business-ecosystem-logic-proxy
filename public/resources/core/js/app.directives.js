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
        .directive('bsTooltip', bsTooltipDirective)
        .directive('fileModel', fileModelDirective)
        .directive('noImage', noImageDirective)
        .directive('fieldUnique', fieldUniqueDirective)
        .directive('businessAddressForm', businessAddressFormDirective)
        .directive('shippingAddressForm', shippingAddressFormDirective)
        .directive('pricePlanForm', pricePlanFormDirective)
        .directive('pricePlanTable', pricePlanTableDirective)
        .directive('relationshipCreateForm', relationshipCreateFormDirective)
        .directive('relationshipDeleteForm', relationshipDeleteFormDirective)
        .directive('convertToDate', convertToDateDirective)
        .directive('convertToNumber', convertToNumberDirective)
        .directive('fieldArray', fieldArrayDirective)
        .directive('convertToPhoneNumber', convertToPhoneNumberDirective);

    function bsTooltipDirective() {
        return {
            restrict: 'A',
            link: link
        };

        function link(scope, element) {
            element.tooltip();
        }
    }

    function fileModelDirective($parse) {
        return {
            restrict: 'A',
            link: link
        };

        function link(scope, element, attrs) {
            var fileSetter = $parse(attrs.fileModel).assign;

            element.on('change', function () {
                scope.$apply(function () {
                    fileSetter(scope, element[0].files[0]);
                });
            });
        }
    }

    function noImageDirective(URLS) {
        return {
            restrict: 'A',
            link: link
        };

        function link(scope, element, attrs) {

            scope.$watch(function () {
                return attrs.ngSrc;
            }, function () {

                if (!attrs.ngSrc) {
                    setDefaultImage(element);
                }
            });

            element.bind('error', function () {
                setDefaultImage(element);
            });
        }

        function setDefaultImage(element) {
            element.attr('src', URLS.IMAGE + '/default-no-image.png');
        }
    }

    function fieldUniqueDirective($http, $injector) {
        return {
            require: 'ngModel',
            link: function (scope, element, attrs, controller) {

                scope.$watch(attrs.ngModel, function (newValue) {
                    var params = {};

                    if (newValue && $injector.has(attrs.fieldUnique)) {
                        if (attrs.fieldOriginalValue != newValue) {
                            params[attrs.name] = newValue;

                            $injector.get(attrs.fieldUnique).exists(params).then(function (found) {
                                controller.$setValidity('unique', !found);
                            });
                        }
                    }
                });
            }
        };
    }

    function pricePlanFormDirective() {
        return {
            restrict: 'E',
            scope: {
                form: '=',
                pricePlan: '=data',
                vm: '=controller'
            },
            templateUrl: 'directives/forms/priceplan'
        };
    }

    function businessAddressFormDirective() {
        return {
            restrict: 'E',
            scope: {
                form: '=',
                emailAddress: '=emailAddress',
                postalAddress: '=postalAddress',
                telephoneNumber: '=telephoneNumber',
                vm: '=controller'
            },
            templateUrl: 'directives/forms/business-address'
        };
    }

    function shippingAddressFormDirective() {
        return {
            restrict: 'E',
            scope: {
                form: '=',
                emailAddress: '=emailAddress',
                postalAddress: '=postalAddress',
                telephoneNumber: '=telephoneNumber',
                vm: '=controller'
            },
            templateUrl: 'directives/forms/shipping-address'
        };
    }

    function pricePlanTableDirective() {
        return {
            restrict: 'E',
            scope: {
                pricePlans: '=data',
                vm: '=controller'
            },
            templateUrl: 'directives/tables/priceplan'
        };
    }

    function relationshipCreateFormDirective() {
        return {
            restrict: 'E',
            scope: {
                resource: '=resource',
                parentVM: '=controller'
            },
            templateUrl: 'directives/forms/relationship-create'
        };
    }

    function relationshipDeleteFormDirective() {
        return {
            restrict: 'E',
            scope: {
                resource: '=resource',
                parentVM: '=controller'
            },
            templateUrl: 'directives/forms/relationship-delete'
        };
    }

    function fieldArrayDirective($http, $injector) {
        return {
            require: 'ngModel',
            link: function (scope, element, attrs, controller) {

                scope.$watch(attrs.ngModel + ".length", function (arrayLength) {
                    var params = {};

                    if (arrayLength != null) {
                        controller.$setValidity('limitFrom', arrayLength >= Number(attrs.limitFrom));
                    }
                });
            }
        };
    }

    function convertToDateDirective() {
        return {
            restrict: 'A',
            require: 'ngModel',
            link: function link(scope, element, attrs, ngModel) {
                ngModel.$parsers.push(function (value) {
                    //View -> Model
                    return value;
                });
                ngModel.$formatters.push(function (value) {
                    //Model -> View
                    return new Date(value);
                });
            }
        };
    }

    function convertToNumberDirective() {
        return {
            restrict: 'A',
            require: 'ngModel',
            link: function link(scope, element, attrs, ngModel) {
                ngModel.$parsers.push(function (value) {
                    //View -> Model
                    return '' + value;
                });
                ngModel.$formatters.push(function (value) {
                    //Model -> View
                    return Number(value);
                });
            }
        };
    }

    function convertToPhoneNumberDirective() {
        return {
            restrict: 'A',
            require: 'ngModel',
            link: function link(scope, element, attrs, ngModel) {
                ngModel.$parsers.push(function (value) {
                    //View -> Model
                    return element.intlTelInput('getNumber');
                });
            }
        };
    }


})();
