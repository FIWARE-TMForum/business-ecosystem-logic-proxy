/**
 *
 */

angular.module('app')
    .factory('User', function ($resource, $injector, URLS, PARTY_ROLES) {

        var Resource, service = {

            ROLES: {
                CUSTOMER: 'Customer',
                SELLER: 'Seller'
            },

            isAuthenticated: function isAuthenticated() {
                return $injector.has('LOGGED_USER');
            },

            serialize: function serialize() {
                return {
                    id: service.current.id,
                    href: service.current.href,
                    role: PARTY_ROLES.OWNER
                };
            },

            get: function get(next) {
                Resource.get({'username': service.current.id}, next);
            },

            updatePartial: function updatePartial(data, next) {
                Resource.updatePartial(data, next);
            }

        };

        if (service.isAuthenticated()) {
            service.current = $injector.get('LOGGED_USER');
        }

        Resource = $resource(URLS.USER, {username: '@id'}, {
            updatePartial: {method: 'PATCH'}
        });

        return service;
    });
