/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the bae-logic-proxy-test of the
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
        .directive('offeringPriceplan', OfferingPriceplanDirective);

    function OfferingPriceplanDirective() {
        var types = {
            'recurring': 'success',
            'one time': 'info',
            'usage': 'warning'
        };

        return {
            restrict: 'A',
            link: link,
            templateUrl: templateUrl
        };

        function link(scope, element, attrs) {
            var selectable = attrs.selectable && attrs.selectable === 'True' ? true : false;

            element.addClass('panel z-depth-1 panel-' + types[scope.priceplan.priceType]);

            if (selectable) {
                element.addClass('selectable');
            }
        }

        function templateUrl(element, attrs) {
            return 'directives/offering-priceplan';
        }
    }

})();
