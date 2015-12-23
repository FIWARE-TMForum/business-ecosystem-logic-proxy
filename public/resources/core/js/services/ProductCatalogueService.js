/**
 *
 */

angular.module('app')
    .factory('Catalogue', function ($rootScope, $resource, $q, URLS, EVENTS, LIFECYCLE_STATUS, PARTY_ROLES, User) {

        var messageTemplate = 'The catalogue <strong>{{ name }}</strong> was {{ action }} successfully.';

        var Resource, service = {

            list: function list(role, filters) {
                var deferred = $q.defer(), params = {};

                if (angular.isObject(filters)) {

                    if (filters.status) {
                        params['lifecycleStatus'] = filters.status;
                    }

                    if (filters.role) {
                        params['relatedParty.role'] = filters.role;
                    }
                }

                switch (role) {
                case User.ROLES.CUSTOMER:
                    params['lifecycleStatus'] = LIFECYCLE_STATUS.LAUNCHED;
                    break;
                case User.ROLES.SELLER:
                    params['relatedParty.id'] = User.current.id;
                    break;
                }

                Resource.query(params, function (catalogueList) {
                    deferred.resolve(catalogueList);
                });

                return deferred.promise;
            },

            exists: function exists(params) {
                var deferred = $q.defer();

                Resource.query(params, function (catalogueList) {
                    deferred.resolve(!!catalogueList.length);
                });

                return deferred.promise;
            },

            create: function create(data) {
                var deferred = $q.defer();

                angular.extend(data, {
                    lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                    relatedParty: [User.serialize()]
                });

                Resource.save(data, function (catalogueCreated) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', messageTemplate, {
                        name: catalogueCreated.name,
                        action: 'created'
                    });

                    deferred.resolve(catalogueCreated);
                });

                return deferred.promise;
            },

            get: function get(catalogueId) {
                var deferred = $q.defer(), params = {
                    catalogueId: catalogueId
                };

                Resource.get(params, function (catalogueRetrieved) {
                    deferred.resolve(catalogueRetrieved);
                });

                return deferred.promise;
            },

            update: function update(catalogue) {
                var deferred = $q.defer(), params = {
                    catalogueId: catalogue.id
                };

                Resource.update(params, catalogue, function (catalogueUpdated) {
                    $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', messageTemplate, {
                        name: catalogueUpdated.name,
                        action: 'updated'
                    });

                    deferred.resolve(catalogueUpdated);
                });

                return deferred.promise;
            },

            hasRoleAs: function hasRoleAs(catalogue, role) {
                return catalogue.relatedParty.some(function (party) {
                    return party.id == User.current.id && party.role == role;
                });
            }

        };

        Resource = $resource(URLS.CATALOGUE_MANAGEMENT + '/catalog/:catalogueId', {catalogueId: '@id'}, {
            update: {method: 'PUT'}
        });

        return service;
    });
