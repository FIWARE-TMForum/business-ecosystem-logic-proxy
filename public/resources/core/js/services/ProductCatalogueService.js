/**
 *
 */

angular.module('app.services')
    .factory('Catalogue', ['$resource', 'URLS', 'User', 'LOGGED_USER', function ($resource, URLS, User, LOGGED_USER) {
        var Catalogue, service;

        service = {

            TYPE: 'Product Catalog',

            ROLES: {
                OWNER: 'Owner',
                SELLER: 'Seller',
            },

            STATUS: {
                ACTIVE: 'Active',
                LAUNCHED: 'Launched',
                RETIRED: 'Retired',
                OBSOLETE: 'Obsolete'
            },

            $collection: [],

            list: function list(role, next) {
                var params = {};

                switch (role) {
                case User.ROLES.CUSTOMER:
                    params = {'lifecycleStatus': service.STATUS.LAUNCHED};
                    break;
                case User.ROLES.SELLER:
                    params = {'relatedParty.id': LOGGED_USER.ID};
                    break;
                default:
                    // TODO: do nothing.
                }

                return Catalogue.query(params, function ($collection) {

                    angular.copy($collection, service.$collection);

                    if (next != null) {
                        next(service.$collection);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            },

            create: function create(data, next) {

                angular.extend(data, {
                    lifecycleStatus: service.STATUS.ACTIVE,
                    relatedParty: [
                        {
                            id: LOGGED_USER.ID,
                            href: LOGGED_USER.HREF,
                            role: service.ROLES.OWNER
                        }
                    ]
                });

                return Catalogue.save(data, function ($catalogueCreated) {
                    service.$collection.unshift($catalogueCreated);

                    if (next != null) {
                        next($catalogueCreated);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            },

            update: function update($catalogue, next) {
                return Catalogue.update({id: $catalogue.id}, $catalogue, function ($catalogueUpdated) {

                    if (next != null) {
                        next($catalogueUpdated);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            }

        };

        Catalogue = $resource(URLS.PRODUCT_CATALOGUE, {catalogueId: '@id'}, {
            update: {method:'PUT'}
        });

        return service;
    }]);
