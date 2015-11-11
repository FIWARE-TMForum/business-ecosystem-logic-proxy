/**
 *
 */

angular.module('app.services')
    .factory('User', ['$resource', 'URLS', 'LOGGED_USER', function ($resource, URLS, LOGGED_USER) {
        var service;

        service = {

            ROLES: {
                CUSTOMER: 'Customer',
                SELLER: 'Seller',
            },

            $collection: []

        };

        return service;
    }]);
