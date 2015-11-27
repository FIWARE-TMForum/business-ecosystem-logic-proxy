/**
 *
 */

angular.module('app.services')
    .factory('Product', ['$resource', 'URLS', 'User', 'LOGGED_USER', function ($resource, URLS, User, LOGGED_USER) {
        var Product, service;

        var serializeProduct = function serializeProduct($product) {
            return {
                id: $product.id,
                href: $product.href
            };
        };

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

            ROLES: {
                OWNER: 'Owner'
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

            create: function create(data, next) {

                angular.extend(data, {
                    lifecycleStatus: service.STATUS.ACTIVE,
                    isBundle: !!data.bundledProductSpecification.length,
                    bundledProductSpecification: data.bundledProductSpecification.map(function ($product) {
                        return serializeProduct($product);
                    }),
                    relatedParty: [
                        {
                            id: LOGGED_USER.ID,
                            href: LOGGED_USER.HREF,
                            role: service.ROLES.OWNER
                        }
                    ]
                });

                return Product.save(data, function ($catalogueCreated) {
                    service.$collection.unshift($catalogueCreated);

                    if (next != null) {
                        next($catalogueCreated);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            },

            update: function update($product, next) {
                return Product.update({id: $product.id}, $product, function ($productUpdated) {

                    if (next != null) {
                        next($productUpdated);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            },

            getBundledProductsOf: function getBundledProductsOf($product, next) {
                var params;

                if ($product.isBundle) {
                    params = {
                        'relatedParty.id': LOGGED_USER.ID,
                        'id': $product.bundledProductSpecification.map(function (data) {
                            return data.id;
                        }).join()
                    };

                    Product.query(params, function ($collection) {
                        angular.copy($collection.slice(), $product.bundledProductSpecification);

                        if (next != null) {
                            next($product.bundledProductSpecification);
                        }
                    }, function (response) {

                    });
                } else {

                    if (!angular.isArray($product.bundledProductSpecification)) {
                        $product.bundledProductSpecification = [];
                    }

                    next($product.bundledProductSpecification);
                }
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

        Product = $resource(URLS.CATALOGUE_MANAGEMENT + '/productSpecification/:productId', {productId: '@id'}, {
            update: {method:'PUT'}
        });

        return service;
    }]);
