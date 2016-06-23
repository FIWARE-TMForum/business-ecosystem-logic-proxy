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

/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
 *         Aitor Magán <amagan@conwet.com>
 */

(function () {

    'use strict';

    angular
        .module('app')
        .factory('Catalogue', CatalogueService);

    function CatalogueService($q, $resource, URLS, LIFECYCLE_STATUS, User) {
        var resource = $resource(URLS.CATALOGUE_MANAGEMENT + '/catalog/:catalogueId', {
            catalogueId: '@id'
        }, {
            update: {
                method: 'PUT'
            }
        });

        resource.prototype.getRoleOf = getRoleOf;

        return {
            search: search,
            exists: exists,
            create: create,
            detail: detail,
            update: update,
            buildInitialData: buildInitialData
        };

        function search(filters) {
            var deferred = $q.defer();
            var params = {};

            if (!angular.isObject(filters)) {
                filters = {};
            }

            if (filters.status) {
                params['lifecycleStatus'] = filters.status;
            }

            if (filters.role) {
                params['relatedParty.role'] = filters.role;
            }

            if (filters.owner) {
                params['relatedParty.id'] = User.loggedUser.id;
            } else {
                params['lifecycleStatus'] = LIFECYCLE_STATUS.LAUNCHED;
            }

            resource.query(params, function (catalogueList) {
                deferred.resolve(catalogueList);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function exists(params) {
            var deferred = $q.defer();

            resource.query(params, function (catalogueList) {
                deferred.resolve(!!catalogueList.length);
            });

            return deferred.promise;
        }

        function create(data) {
            var deferred = $q.defer();

            resource.save(data, function (catalogueCreated) {
                deferred.resolve(catalogueCreated);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function detail(catalogueId) {
            var deferred = $q.defer();
            var params = {
                catalogueId: catalogueId
            };

            resource.get(params, function (catalogueRetrieved) {
                deferred.resolve(catalogueRetrieved);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function update(catalogue) {
            var deferred = $q.defer();
            var params = {
                catalogueId: catalogue.id
            };

            resource.update(params, catalogue, function (catalogueUpdated) {
                deferred.resolve(catalogueUpdated);
            }, function (response) {
                deferred.reject(response);
            });

            return deferred.promise;
        }

        function buildInitialData() {
            return {
                lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                relatedParty: [
                    User.serialize()
                ]
            };
        }

        function getRoleOf(userId) {
            /* jshint validthis: true */
            var i, role;

            for (i = 0; i < this.relatedParty.length && !role; i++) {
                if (this.relatedParty[i].id == userId) {
                    role = this.relatedParty[i].role;
                }
            }

            return role;
        }
    }

})();
