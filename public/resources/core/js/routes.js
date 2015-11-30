/**
 *
 */

angular.module('app')
    .config(['$routeProvider', '$injector', 'URLS', function ($routeProvider, $injector, URLS) {
        var userRole = $injector.has('LOGGED_USER') ? $injector.get('LOGGED_USER').ROLE : 'Customer';

        switch (userRole) {
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
