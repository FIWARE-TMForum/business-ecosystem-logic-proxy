
angular.module('app')
    .config(function ($stateProvider, $injector) {

        if ($injector.has('LOGGED_USER')) {

            $stateProvider
                .state('app.inventory.product', {
                    url: '/order',
                    templateUrl: 'customer/inventory-product/search'
                });
        }
    });
