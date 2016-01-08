/**
 * @author Francisco de la Vega <fdelavega@conwet.com>
 *         Jaime Pajuelo <jpajuelo@conwet.com>
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
                deferred.reject(response.status);
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
