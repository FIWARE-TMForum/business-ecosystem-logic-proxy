/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .filter('status', statusFilter);

    function statusFilter() {
        return function (list) {
            var statusList = Array.prototype.slice.call(arguments, 1);

            return list.filter(function (element) {
                return statusList.indexOf(element.lifecycleStatus) !== -1;
            });
        };
    }

})();
