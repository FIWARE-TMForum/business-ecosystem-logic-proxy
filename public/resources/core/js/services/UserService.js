/**
 *
 */

angular.module('app.services')
    .factory('User', ['$resource', '$injector', 'URLS', function ($resource, $injector, URLS) {
        var LOGGED_USER, User, service;

        if ($injector.has('LOGGED_USER')) {
            LOGGED_USER = $injector.get('LOGGED_USER');
        }

        service = {

            ROLES: {
                CUSTOMER: 'Customer',
                OWNER: 'Owner',
                SELLER: 'Seller'
            },

            getID: function getID() {
                return LOGGED_USER.ID;
            },

            getRole: function getRole() {

                if (service.isAuthenticated()) {
                    return LOGGED_USER.ROLE;
                }

                return service.ROLES.CUSTOMER;
            },

            serialize: function serialize() {
                return {
                    id: service.getID(),
                    href: LOGGED_USER.HREF,
                    role: service.ROLES.OWNER
                };
            },

            isAuthenticated: function isAuthenticated() {
                return LOGGED_USER != null;
            },

            get: function(next) {
                User.get({'username': LOGGED_USER.ID}, next);
            },

            updatePartial: function(data, next) {
                User.updatePartial(data, next);
            }

        };

        User = $resource(URLS.USER, {username: '@id'}, {
            updatePartial: {method: 'PATCH'}
        });

        return service;
    }]);
