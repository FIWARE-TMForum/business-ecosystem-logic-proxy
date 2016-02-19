/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .config(OfferingRouteConfig);

    function OfferingRouteConfig($stateProvider) {

        $stateProvider
            .state('offering', {
                url: '/offering?catalogueId&categoryId&type',
                data: {
                    title: 'Marketplace',
                    loggingRequired: false,
                    filters: ['type']
                },
                views: {
                    sidebar: {
                        templateUrl: 'offering/sidebar',
                        controller: 'CatalogueListCtrl as listVM'
                    },
                    content: {
                        templateUrl: 'offering/search',
                        controller: 'OfferingSearchCtrl as searchVM'
                    }
                }
            })
            .state('offering.detail', {
                url: '/:offeringId',
                views: {
                    'sidebar@': {
                        template:  '<ui-view>'
                    },
                    'content@': {
                        templateUrl: 'offering/detail',
                        controller: 'OfferingDetailCtrl as detailVM'
                    }
                }
            })
            .state('offering.detail.productCharacteristic', {
                url: '/characteristic',
                views: {
                    'offering-content': {
                        templateUrl: 'offering/detail/product'
                    }
                }
            })
            .state('offering.detail.pricePlan', {
                url: '/priceplan',
                views: {
                    'offering-content': {
                        templateUrl: 'offering/detail/pricing'
                    }
                }
            });
    }

})();
