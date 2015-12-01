/**
 *
 */

angular.module('app.services')
    .factory('Catalogue', ['$resource', 'URLS', 'User', function ($resource, URLS, User) {

        var Catalogue, service = {

            STATUS: {
                ACTIVE: 'Active',
                LAUNCHED: 'Launched',
                RETIRED: 'Retired',
                OBSOLETE: 'Obsolete'
            },

            $collection: [],

            $collectionById: {},

            list: function list(next, cached) {
                var params = {};

                if (typeof cached !== 'boolean') {
                    cached = true;
                }

                switch (User.getRole()) {
                case User.ROLES.CUSTOMER:
                    params = {'lifecycleStatus': service.STATUS.LAUNCHED};
                    break;
                case User.ROLES.SELLER:
                    params = {'relatedParty.id': User.getID()};
                    break;
                default:
                    // TODO: do nothing.
                }

                Catalogue.query(params, function ($collection) {

                    if (cached) {
                        angular.copy($collection, service.$collection);

                        service.$collection.forEach(function ($catalogue) {
                            service.$collectionById[$catalogue.id] = $catalogue;
                        });
                    }

                    if (next != null) {
                        next(cached ? service.$collection : $collection);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            },

            find: function find(params, next, cached) {

                if (typeof cached !== 'boolean') {
                    cached = true;
                }

                Catalogue.query(params, function ($collection) {

                    if (cached) {
                        angular.copy($collection, service.$collection);
                    }

                    if (next != null) {
                        next(cached ? service.$collection : $collection);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            },

            hasRoleAs: function hasRoleAs($catalogue, partyRole) {
                return $catalogue.relatedParty.some(function (party) {
                    return party.id == User.getID() && party.role == partyRole;
                });
            },

            create: function create(data, next) {

                angular.extend(data, {
                    lifecycleStatus: service.STATUS.ACTIVE,
                    relatedParty: [User.serialize()]
                });

                Catalogue.save(data, function ($catalogueCreated) {

                    service.$collection.unshift($catalogueCreated);

                    if (next != null) {
                        next($catalogueCreated);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            },

            update: function update($catalogue, next, cached) {
                var index = service.$collection.indexOf(service.$collectionById[$catalogue.id]);

                if (typeof cached !== 'boolean') {
                    cached = true;
                }

                Catalogue.update({id: $catalogue.id}, $catalogue, function ($catalogueUpdated) {

                    if (cached) {
                        angular.copy($catalogueUpdated, service.$collection[index]);
                        service.$collectionById[$catalogueUpdated.id] = service.$collection[index];
                    }

                    if (next != null) {
                        next(cached ? service.$collection[index] : $catalogueUpdated);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            }

        };

        Catalogue = $resource(URLS.CATALOGUE_MANAGEMENT + '/catalog/:catalogueId', {catalogueId: '@id'}, {
            update: {method:'PUT'}
        });

        return service;
    }]);
