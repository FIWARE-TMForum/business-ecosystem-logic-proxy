/* Copyright (c) 2021 Future Internet Consulting and Development Solutions S.L.
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

    angular.module('app').factory('IdpsService', ['$q', '$resource', 'URLS', IdpsService]);

    function IdpsService($q, $resource, URLS) {
        const resource = $resource(URLS.IDP, {
            idpId: '@idpId',
        }, {
            update: { method: 'PUT' }
        });

        const listResource = $resource(URLS.IDPS, {});

        function getIdps (search) {
            const deferred = $q.defer();
            let params = {}

            if (search != null && search != '') {
                params = {
                    search: search
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

        function getIdp(idpId) {
            const deferred = $q.defer();
            const params = {
                idpId: idpId
            };

            resource.get(
                params,
                function(idp) {
                    deferred.resolve(idp);
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;
        }

        function exists(params) {
            var deferred = $q.defer();

            resource.query(params, function(idpList) {
                deferred.resolve(!!idpList.length);
            });

            return deferred.promise;
        }

        function createIdp(data) {
            const deferred = $q.defer();

            listResource.save(
                data,
                function(categoryCreated) {
                    deferred.resolve(categoryCreated);
                },
                function(response) {
                    deferred.reject(response);
                }
            );

            return deferred.promise;
        }

        function updateIdp(idpId, data) {
            const deferred = $q.defer();
            resource.update({idpId: idpId}, data, 
                function() {
                    deferred.resolve();
                },
                function(response) {
                    deferred.reject(response);
                }
            )

            return deferred.promise;
        }

        function deleteIdp(idpId) {
            const deferred = $q.defer();
            resource.delete({idpId: idpId},
                function() {
                    deferred.resolve();
                },
                function(response) {
                    deferred.reject(response);
                }
            );
            return deferred.promise;
        }

        return {
            getIdps: getIdps,
            getIdp: getIdp,
            exists: exists,
            createIdp: createIdp,
            updateIdp: updateIdp,
            deleteIdp: deleteIdp
        };
    }

})();