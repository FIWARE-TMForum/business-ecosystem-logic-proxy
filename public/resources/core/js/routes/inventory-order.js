
angular.module('app')
    .config(function ($stateProvider, $injector) {

        if ($injector.has('LOGGED_USER')) {

            $stateProvider
                .state('app.inventory.order', {
                    url: '/order',
                    templateUrl: 'customer/inventory-order/search'
                });
        }
    });
