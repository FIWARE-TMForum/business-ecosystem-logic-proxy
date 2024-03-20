/* Copyright (c) 2023 Future Internet Consulting and Development Solutions S.L.
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


(function() {
    'use strict';

    angular
        .module('app')
        .factory('ServiceInventory', ['$q', '$resource', 'URLS', 'User', ServiceInventory]);

    function ServiceInventory($q, $resource, URLS, User) {
        const resource = $resource(URLS.SERVICE_INVENTORY + '/service/:serviceId', {
            serviceId: '@id'
        });

        function search(filters) {
            const params = {}

            if (!angular.isObject(filters)) {
                filters = {};
            }

            if (filters.customer) {
                params['relatedParty.id'] = User.loggedUser.currentUser.partyId;
            }

            if (filters.status) {
                params['status'] = filters.status;
            }

            if (filters.offset !== undefined) {
                params['offset'] = filters.offset;
                params['limit'] = filters.limit;
            }

            return new Promise((resolve, reject) => {
                resource.query(params, (services) => {
                    resolve(services)
                })
            })
        }

        function detail(serviceId) {
            const params = {
                serviceId: serviceId
            }

            return new Promise((resolve, reject) => {
                resource.get(params, (service) => {
                    resolve(service)
                })
            })
        }

        return {
            search: search,
            detail: detail
        }
    }
})();