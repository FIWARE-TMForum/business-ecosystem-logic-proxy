/**
 *
 */

angular.module('app')
    .config(['$routeProvider', 'LOGGED_USER', 'URLS', function ($routeProvider, LOGGED_USER, URLS) {

        switch (LOGGED_USER.ROLE) {
        case 'Customer':
            break;
        case 'Seller':
            $routeProvider
                .when('/products', {
                    templateUrl: URLS.TEMPLATE + '/ProductView.html',
                    controller: 'ProductView'
                })
                .when('/catalogues', {
                    templateUrl: URLS.TEMPLATE + '/ProductCatalogueView.html',
                    controller: 'CatalogueView'
                })
                .when('/offerings', {
                    templateUrl: URLS.TEMPLATE + '/ProductOfferingView.html',
                    controller: 'OfferingView'
                })
                .otherwise({
                    redirectTo: '/products'
                });
            break;
        default:
            // do nothing.
        }
    }]);
