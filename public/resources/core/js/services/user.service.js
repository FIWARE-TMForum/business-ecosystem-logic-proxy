/**
 *
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('User', UserService);

    function UserService($resource, $injector, URLS, PARTY_ROLES) {
        var resource = $resource(URLS.USER, {
            username: '@id'
        }, {
            updatePartial: {
                method: 'PATCH'
            }
        });

        var loggedUser = $injector.has('LOGGED_USER') ? $injector.get('LOGGED_USER') : null;

        return {
            detail: detail,
            updatePartial: updatePartial,
            loggedUser: loggedUser,
            isAuthenticated: isAuthenticated,
            serialize: serialize
        };

        function detail(next) {
            resource.get({username: loggedUser.id}, next);
        }

        function updatePartial(data, next) {
            resource.updatePartial(data, next);
        }

        function isAuthenticated() {
            return angular.isObject(loggedUser);
        }

        function serialize() {
            return {
                id: loggedUser.id,
                href: loggedUser.href,
                role: PARTY_ROLES.OWNER
            };
        }
    }

})();
