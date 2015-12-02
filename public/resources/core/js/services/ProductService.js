/**
 *
 */

angular.module('app.services')
    .factory('Product', ['$resource', 'URLS', 'LIFECYCLE_STATUS', 'User', function ($resource, URLS, LIFECYCLE_STATUS, User) {

        var serializeProduct = function serializeProduct($product) {
            return {
                id: $product.id,
                href: $product.href
            };
        };

        var Product, service = {

            TYPES: {
                PRODUCT: 'Product',
                PRODUCT_BUNDLE: 'Product Bundle'
            },

            $collection: [],

            list: function list(next) {
                var params = {'relatedParty.id': User.getID()};

                Product.query(params, function ($collection) {

                    angular.copy($collection, service.$collection);

                    if (next != null) {
                        next(service.$collection);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            },

            filter: function filter(userQuery, next) {
                var params = {'relatedParty.id': User.getID()};

                if (userQuery.type in service.TYPES) {
                    params.isBundle = (service.TYPES[userQuery.type] !== service.TYPES.PRODUCT);
                }

                if (userQuery.status in LIFECYCLE_STATUS) {
                    params.lifecycleStatus = LIFECYCLE_STATUS[userQuery.status];
                }

                if (userQuery.brand) {
                    params.brand = userQuery.brand;
                }

                Product.query(params, function ($collection) {

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
                    lifecycleStatus: LIFECYCLE_STATUS.ACTIVE,
                    isBundle: !!data.bundledProductSpecification.length,
                    bundledProductSpecification: data.bundledProductSpecification.map(function ($product) {
                        return serializeProduct($product);
                    }),
                    relatedParty: [User.serialize()]
                });

                Product.save(data, function ($catalogueCreated) {

                    service.$collection.unshift($catalogueCreated);

                    if (next != null) {
                        next($catalogueCreated);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            },

            update: function update($product, next) {
                var index = service.$collection.indexOf($product);

                Product.update({id: $product.id}, $product, function ($productUpdated) {

                    service.$collection[index] = $productUpdated;

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
                        'relatedParty.id': User.getID(),
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
                var params = {'relatedParty.id': User.getID(), 'fields': 'brand'};

                Product.query(params, function ($collection) {
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
