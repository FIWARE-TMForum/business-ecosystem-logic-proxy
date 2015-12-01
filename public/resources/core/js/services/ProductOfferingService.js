/**
 *
 */

angular.module('app.services')
    .factory('Offering', ['$resource', 'URLS', 'User', 'Product', function ($resource, URLS, User, Product) {

        var serializeProduct = function serializeProduct($product) {
            return {
                id: $product.id,
                href: $product.href
            };
        };

        var Offering, service = {

            STATUS: {
                ACTIVE: 'Active',
                LAUNCHED: 'Launched',
                RETIRED: 'Retired',
                OBSOLETE: 'Obsolete'
            },

            TYPES: {
                OFFERING: 'Offering',
                OFFERING_BUNDLE: 'Offering bundle'
            },

            $collection: [],

            list: function list($catalogue, next) {
                var params = {};

                switch (User.getRole()) {
                case User.ROLES.CUSTOMER:
                    break;
                case User.ROLES.SELLER:

                    Product.list(function ($productList) {
                        var products = {};

                        if ($productList.length) {

                            if ($catalogue != null) {
                                params['catalogueId'] = $catalogue.id;
                            }

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

                if (userQuery.status in service.STATUS) {
                    params.lifecycleStatus = service.STATUS[userQuery.status];
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

                if (offeringInfo.productSpecification.lifecycleStatus == service.STATUS.ACTIVE) {
                    offeringInfo.productSpecification.lifecycleStatus = service.STATUS.LAUNCHED;
                    Product.update(offeringInfo.productSpecification);
                }

                $product = offeringInfo.productSpecification;

                angular.extend(offeringInfo, {
                    lifecycleStatus: service.STATUS.ACTIVE
                });

                offeringInfo.productSpecification = serializeProduct(offeringInfo.productSpecification);

                Offering.save({catalogueId: $catalogue.id}, offeringInfo, function ($offeringCreated) {
                    $offeringCreated.productSpecification = $product;
                    service.$collection.unshift($offeringCreated);

                    if (next != null) {
                        next($offeringCreated);
                    }
                }, function (response) {
                    // TODO: onfailure.
                });
            }

        };

        Offering = $resource(URLS.CATALOGUE_MANAGEMENT + '/:catalogueId/productOffering/:offeringId', {offeringId: '@id'}, {
        });

        return service;
    }]);
