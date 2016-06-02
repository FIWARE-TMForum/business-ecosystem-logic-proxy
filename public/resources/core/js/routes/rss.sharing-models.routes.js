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
            .state('rss.models', {
                url: '/models',
                templateUrl: 'rss/sharing-models/search',
                controller: 'RSModelSearchCtrl as searchVM'
            })
            .state('rss.models.create', {
                url: '/create',
                templateUrl: 'rss/sharing-models/create',
                controller: 'RSModelCreateCtrl as createVM'
            })
            .state('rss.models.update', {
                url: '/:productClass',
                templateUrl: 'rss/sharing-models/update',
                controller: 'RSModelUpdateCtrl as updateVM'
            })
    }

})();
