/**
 *
 */

angular.module('app.services')
    .factory('Product', ['$resource', 'URLS', 'User', 'LOGGED_USER', function ($resource, URLS, User, LOGGED_USER) {
        var Product, service;

        service = {

            TYPES: {
                PRODUCT: 'Product',
                PRODUCT_BUNDLE: 'Product Bundle'
            },

            STATUS: {
                ACTIVE: 'Active',
                LAUNCHED: 'Launched',
                RETIRED: 'Retired',
                OBSOLETE: 'Obsolete'
            },

            $collection: [],

            list: function list(next) {
                var params = {'relatedParty.id': LOGGED_USER.ID};

                return Product.query(params, function ($collection) {

                    angular.copy($collection, service.$collection);

                    if (next != null) {
                        next(service.$collection);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            },

            filter: function filter(userQuery, next) {
                var params = {'relatedParty.id': LOGGED_USER.ID};

                if (userQuery.type in service.TYPES) {
                    params.isBundle = (service.TYPES[userQuery.type] !== service.TYPES.PRODUCT);
                }

                if (userQuery.status in service.STATUS) {
                    params.lifecycleStatus = service.STATUS[userQuery.status];
                }

                if (userQuery.brand) {
                    params.brand = userQuery.brand;
                }

                return Product.query(params, function ($collection) {

                    angular.copy($collection, service.$collection);

                    if (next != null) {
                        next(service.$collection);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            },

            getBrands: function getBrands(next) {
                var params = {'relatedParty.id': LOGGED_USER.ID, 'fields': 'brand'};

                return Product.query(params, function ($collection) {
                    var brandSet = {};

                    $collection.forEach(function ($product) {
                        brandSet[$product.brand] = 0;
                    });

                    if (next != null) {
                        next(Object.keys(brandSet));
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            }

        };

        Product = $resource(URLS.PRODUCT, {id: '@id'}, {
        });

        return service;
    }]);
