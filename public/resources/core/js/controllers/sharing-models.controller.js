/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .controller('RSModelSearchCtrl', RSModelSearchController)
        .controller('RSModelCreateCtrl', RSModelCreateController)
        .controller('RSModelUpdateCtrl', RSModelUpdateController);

    function RSModelSearchController(DATA_STATUS, RSS, Utils) {
        var vm = this;

        vm.list = [];

        RSS.search().then(function (modelsList) {
            angular.copy(modelsList, vm.list);
            vm.list.status = DATA_STATUS.LOADED;
        }, function (response) {
            vm.error = Utils.parseError(response, 'It was impossible to load the list of revenue sharing models');
            vm.list.status = DATA_STATUS.ERROR;
        });
    }

    function RSModelCreateController() {

    }

    function RSModelUpdateController () {

    }
})();
