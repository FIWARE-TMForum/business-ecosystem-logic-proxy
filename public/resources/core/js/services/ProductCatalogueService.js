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

            list: function list(next) {
                var params = {};

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

                    angular.copy($collection, service.$collection);

                    if (next != null) {
                        next(service.$collection);
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

            update: function update($catalogue, next) {
                var index = service.$collection.indexOf($catalogue);

                Catalogue.update({id: $catalogue.id}, $catalogue, function ($catalogueUpdated) {

                    service.$collection[index] = $catalogueUpdated;

                    if (next != null) {
                        next($catalogueUpdated);
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
