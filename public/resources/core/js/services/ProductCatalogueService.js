/**
 *
 */

angular.module('app.services')
    .factory('Catalogue', ['$rootScope', '$resource', 'URLS', 'EVENTS', 'LIFECYCLE_STATUS', 'PARTY_ROLES', 'User', function ($rootScope, $resource, URLS, EVENTS, LIFECYCLE_STATUS, PARTY_ROLES, User) {

        var Catalogue, service = {

            MESSAGES: {
                CREATED: 'The catalogue <strong>{{ name }}</strong> was created successfully.',
                UPDATED: 'The catalogue <strong>{{ name }}</strong> was updated successfully.'
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
                    params = {'lifecycleStatus': LIFECYCLE_STATUS.LAUNCHED};
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

            filter: function filter(userQuery, next, cached) {
                var params = {'relatedParty.id': User.getID()};

                if (typeof cached !== 'boolean') {
                    cached = true;
                }

                if (userQuery.status in LIFECYCLE_STATUS) {
                    params['lifecycleStatus'] = LIFECYCLE_STATUS[userQuery.status];
                }

                if (userQuery.role in PARTY_ROLES) {
                    params['relatedParty.role'] = PARTY_ROLES[userQuery.role];
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

            create: function create(data, next, cached) {

                if (typeof cached !== 'boolean') {
                    cached = true;
                }

                angular.extend(data, {
                    lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                    relatedParty: [User.serialize()]
                });

                Catalogue.save(data, function ($catalogueCreated) {

                    if (cached) {
                        service.$collection.unshift($catalogueCreated);
                        $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', service.MESSAGES.CREATED, $catalogueCreated);
                    }

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

                        $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', service.MESSAGES.UPDATED, $catalogueUpdated);
                    }

                    if (next != null) {
                        next(cached ? service.$collection[index] : $catalogueUpdated);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            },

            updateStatus: function updateStatus($catalogue, lifecycleStatus, next, cached) {
                var index = service.$collection.indexOf(service.$collectionById[$catalogue.id]);

                if (typeof cached !== 'boolean') {
                    cached = true;
                }

                $catalogue.lifecycleStatus = lifecycleStatus;

                Catalogue.update({id: $catalogue.id}, $catalogue, function ($catalogueUpdated) {

                    if (cached) {
                        angular.copy($catalogueUpdated, service.$collection[index]);
                        service.$collectionById[$catalogueUpdated.id] = service.$collection[index];

                        $rootScope.$broadcast(EVENTS.MESSAGE_SHOW, 'success', service.MESSAGES.UPDATED, $catalogueUpdated);
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
