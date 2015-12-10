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

            EVENTS: {
                FILTER: '$productFilter',
                FILTERVIEW_SHOW: '$productFilterViewShow',
                UPDATEVIEW_SHOW: '$productUpdateViewShow'
            },

            STATUS: LIFECYCLE_STATUS,

            TYPES: {
                PRODUCT: 'Product',
                PRODUCT_BUNDLE: 'Product Bundle'
            },

            $collection: [],

            list: function list() {
                var next, wasSearch = false, params = {};

                switch (User.getRole()) {
                case User.ROLES.CUSTOMER:
                    break;
                case User.ROLES.SELLER:
                    params['relatedParty.id'] = User.getID();
                    break;
                }

                if (arguments.length > 0) {
                    if (angular.isFunction(arguments[0])) {
                        next = arguments[0];
                    } else {
                        if (angular.isObject(arguments[0])) {

                            var filters = arguments[0];

                            if (filters.type in service.TYPES) {
                                params.isBundle = (service.TYPES[filters.type] !== service.TYPES.PRODUCT);
                                wasSearch = true;
                            }

                            if ('status' in filters && filters.status.length) {
                                params.lifecycleStatus = filters.status.join();
                                wasSearch = true;
                            }
                        }

                        if (arguments.length > 1) {
                            if (angular.isFunction(arguments[1])) {
                                next = arguments[1];
                            }
                        }
                    }
                }

                Product.query(params, function ($collection) {

                    angular.copy($collection, service.$collection);

                    if (next != null) {
                        next(service.$collection, wasSearch);
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

            getPictureOf: function getPictureOf($product) {
                var i, src = "";

                if ('attachment' in $product) {
                    for (i = 0; i < $product.attachment.length && !src.length; i++) {
                        if ($product.attachment[i].type == 'Picture') {
                            src = $product.attachment[i].url;
                        }
                    }
                }

                return src;
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
