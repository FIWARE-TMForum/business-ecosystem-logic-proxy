/**
 *
 */

angular.module('app.services')
    .factory('Offering', ['$resource', 'URLS', 'LIFECYCLE_STATUS', 'User', 'Product', function ($resource, URLS, LIFECYCLE_STATUS, User, Product) {

        var serializeProduct = function serializeProduct($product) {
            return {
                id: $product.id,
                href: $product.href
            };
        };

        var CatalogueOffering, Offering, service = {

            TYPES: {
                OFFERING: 'Offering',
                OFFERING_BUNDLE: 'Offering bundle'
            },

            $collection: [],

            list: function list($catalogue, next) {
                var params = {};

                switch (User.getRole()) {
                case User.ROLES.CUSTOMER:
                    params['lifecycleStatus'] = LIFECYCLE_STATUS.LAUNCHED;

                    Offering.query(params, function ($collection) {
                        var filterParams = {};

                        angular.copy($collection, service.$collection);

                        if (service.$collection.length) {

                            filterParams['id'] = service.$collection.map(function ($offering) {
                                return $offering.productSpecification.id;
                            }).join();

                            Product.list(filterParams, function ($productList) {
                                var products = {};

                                service.$collection.forEach(function ($offering) {
                                    $productList.forEach(function ($product) {
                                        if ($offering.productSpecification.id == $product.id) {
                                            $offering.productSpecification = $product;
                                        }
                                    });
                                });

                                if (next != null) {
                                    next(service.$collection);
                                }
                            });
                        } else {
                            if (next != null) {
                               next(service.$collection);
                            }
                        }
                    }, function (response) {
                        // TODO: onfailure.
                    });

                    break;
                case User.ROLES.SELLER:

                    Product.list(function ($productList) {
                        var products = {};

                        if ($productList.length) {

                            params['productSpecification.id'] = $productList.map(function ($product) {
                                products[$product.id] = $product;
                                return $product.id;
                            }).join();

                            if ($catalogue != null) {
                                params['catalogueId'] = $catalogue.id;
                                CatalogueOffering.query(params, function ($collection) {

                                    angular.copy($collection, service.$collection);

                                    service.$collection.forEach(function ($offering) {
                                        $offering.productSpecification = products[$offering.productSpecification.id];
                                    });

                                    if (next != null) {
                                        next(service.$collection);
                                    }
                                }, function (response) {
                                    // TODO: onfailure.
                                });
                            } else {
                                Offering.query(params, function ($collection) {

                                    angular.copy($collection, service.$collection);

                                    service.$collection.forEach(function ($offering) {
                                        $offering.productSpecification = products[$offering.productSpecification.id];
                                    });

                                    if (next != null) {
                                        next(service.$collection);
                                    }
                                }, function (response) {
                                    // TODO: onfailure.
                                });
                            }
                        }
                    });

                    break;
                default:
                    // TODO: do nothing.
                }
            },

            filter: function filter(userQuery, next) {
                var params = {};

                if (userQuery.type in service.TYPES) {
                    params.isBundle = (service.TYPES[userQuery.type] !== service.TYPES.OFFERING);
                }

                if (userQuery.status in LIFECYCLE_STATUS) {
                    params.lifecycleStatus = LIFECYCLE_STATUS[userQuery.status];
                }

                Product.list(function ($productList) {
                    var products = {};

                    params['productSpecification.id'] = $productList.map(function ($product) {
                        products[$product.id] = $product;
                        return $product.id;
                    }).join();

                    Offering.query(params, function ($collection) {

                        angular.copy($collection, service.$collection);

                        service.$collection.forEach(function ($offering) {
                            $offering.productSpecification = products[$offering.productSpecification.id];
                        });

                        if (next != null) {
                            next(service.$collection);
                        }
                    }, function (response) {
                        // TODO: onfailure.
                    });
                });
            },

            create: function create(offeringInfo, $catalogue, next) {
                var $product;

                if (offeringInfo.productSpecification.lifecycleStatus == LIFECYCLE_STATUS.ACTIVE) {
                    offeringInfo.productSpecification.lifecycleStatus = LIFECYCLE_STATUS.LAUNCHED;
                    Product.update(offeringInfo.productSpecification);
                }

                $product = offeringInfo.productSpecification;

                angular.extend(offeringInfo, {
                    lifecycleStatus: LIFECYCLE_STATUS.ACTIVE
                });

                offeringInfo.productSpecification = serializeProduct(offeringInfo.productSpecification);

                CatalogueOffering.save({catalogueId: $catalogue.id}, offeringInfo, function ($offeringCreated) {
                    $offeringCreated.productSpecification = $product;
                    service.$collection.unshift($offeringCreated);

                    if (next != null) {
                        next($offeringCreated);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            },

            getProductPictureOf: function getProductPictureOf($offering) {
                return Product.getPictureOf($offering.productSpecification);
            }

        };

        CatalogueOffering = $resource(URLS.CATALOGUE_MANAGEMENT + '/catalog/:catalogueId/productOffering/:offeringId',
            {offeringId: '@id'},
            {}
        );

        Offering = $resource(URLS.CATALOGUE_MANAGEMENT + '/productOffering/:offeringId',
            {offeringId: '@id'},
            {}
        );

        return service;
    }]);
