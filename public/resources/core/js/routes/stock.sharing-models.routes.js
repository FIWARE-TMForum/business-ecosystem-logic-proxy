/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(RSModelsRouteConfig);

    function RSModelsRouteConfig($stateProvider) {

        $stateProvider
            .state('stock.models', {
                url: '/models',
                templateUrl: 'stock/sharing-models/search',
                controller: 'RSModelSearchCtrl as searchVM'
            })
            .state('stock.models.create', {
                url: '/create',
                templateUrl: 'stock/sharing-models/create',
                controller: 'RSModelCreateCtrl as createVM'
            })
            .state('stock.models.update', {
                url: '/:productClass',
                templateUrl: 'stock/sharing-models/update',
                controller: 'RSModelUpdateCtrl as updateVM'
            })
    }

})();
