/* Copyright (c) 2015 - 2016 CoNWeT Lab., Universidad Politécnica de Madrid
 *
 * This file belongs to the business-ecosystem-logic-proxy of the
 * Business API Ecosystem
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('User', UserService);

    function UserService($resource, $injector, $location, URLS, PARTY_ROLES) {
        var resource = $resource(URLS.USER, {
            username: '@id'
        }, {
            updatePartial: {
                method: 'PATCH'
            }
        });

        var loggedUser = $injector.has('LOGGED_USER') ? $injector.get('LOGGED_USER') : null;

	if (loggedUser != null) {
	    var organizations = JSON.parse(loggedUser.organizations.replace(/&quot;/g, '"'));
	    loggedUser.organizations = organizations.organizations;
	}
	
        return {
            detail: detail,
            updatePartial: updatePartial,
            loggedUser: loggedUser,
            isAuthenticated: isAuthenticated,
            serialize: serialize,
            serializeBasic: serializeBasic
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
            var userInfo = serializeBasic();
            userInfo.role = PARTY_ROLES.OWNER;

            return userInfo;
        }

        function serializeBasic() {
            return {
                id: loggedUser.currentUser.id,
                href: $location.protocol() + '://' + $location.host() + ':' + $location.port() + loggedUser.currentUser.href
            };
        }
    }

})();
