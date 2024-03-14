/* Copyright (c) 2024 Future Internet Consulting and Development Solutions S.L.
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

    angular.module('app').factory('Usage', ['$q', '$resource', 'URLS', UsageService]);

    function UsageService($q, $resource, URLS) {
        const listResource = $resource(URLS.USAGE_MANAGEMENT + '/usage', {});

        function getUsages (id, productId) {

            const deferred = $q.defer();
            let params = {}

            if (id != null && id != '') {
                params = {
                    'relatedParty.id': id,
                    'usageCharacteristic.value': productId,
                    'limit': 1000
                };
            }

            listResource.query(
                params,
                (itemList) => {
                    deferred.resolve(itemList);
                },
                (response) => {
                    deferred.reject(response);
                }
            );
    
            return deferred.promise;
        }

        return {
            getUsages: getUsages,
        };
    }

})();