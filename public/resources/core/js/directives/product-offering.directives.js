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
